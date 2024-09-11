import { db } from "./middleware/db.js";
import { lkClient } from "./livekit.js";
import axios from "axios";
import "dotenv/config";

const { EMQX_USERNAME, EMQX_PASSWORD, EMQX_HOST, EMQX_PORT } = process.env;

function isUUIDv4(str: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(str);
}

const main = async () => {
  const startTime = Date.now();
  const lkData = (await lkClient.listRooms())
    .filter((room) => isUUIDv4(room.name))
    .map((room) => ({
      id: room.name,
      participantCount: room.numParticipants,
      listenerCount: 0,
    }))
    .sort((a, b) => b.participantCount - a.participantCount);

  console.log(`FETCHED ${lkData.length} ROOMS from LK Server`);

  // Fetch Listener Count
  for (const room of lkData) {
    try {
      const response = await axios.get(
        `${EMQX_HOST}:${EMQX_PORT}/api/v5/subscriptions?topic=room/${room.id}/listener&limit=1`,
        {
          auth: {
            username: EMQX_USERNAME || "",
            password: EMQX_PASSWORD || "",
          },
        }
      );
      room.listenerCount = response.data.meta.count;
    } catch {
      console.log("Error fetching listeners for room: " + room.id);
    }
  }

  for (const room of lkData) {
    console.log(
      `Updating room: ${room.id} in DB - ${room.participantCount} participants, ${room.listenerCount} listeners`
    );
    try {
      await db.room.update({
        where: {
          id: room.id,
        },
        data: {
          participant_count: room.participantCount,
          listener_count: room.listenerCount,
        },
      });
    } catch {
      console.log("Error updating room: " + room.id);
    }
  }

  const dbRooms = await db.room.findMany({
    where: {
      status: "active",
      id: {
        notIn: lkData.map((room) => room.id),
      },
    },
    select: {
      id: true,
      title: true,
    },
  });

  console.log(`
_________________________________
Total Rooms: ${lkData.length}
Total Particiants: ${lkData.reduce(
    (acc, room) => acc + room.participantCount,
    0
  )}
Total Listeners: ${lkData.reduce((acc, room) => acc + room.listenerCount, 0)} 
_________________________________ 
  \n`);
  console.log(`
\n
FOUND ${dbRooms.length} rooms active in DB not on media nodes`);
  dbRooms.forEach((room) => {
    console.log(`Room ID: ${room.id} - ${room.title}`);
  });
  console.log(`Time taken: ${Date.now() - startTime}ms`);
};

setInterval(main, 5000);
