import { ImageResponse } from "next/og";
import { GiftMark } from "./_mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<GiftMark size={512} />, size);
}
