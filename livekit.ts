import { Room, RoomServiceClient } from "livekit-server-sdk";
import "dotenv/config";

const { LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_KEY_SECRET } = process.env;

export const lkClient = new RoomServiceClient(
  LIVEKIT_HOST ? LIVEKIT_HOST : "",
  LIVEKIT_API_KEY,
  LIVEKIT_API_KEY_SECRET
);
