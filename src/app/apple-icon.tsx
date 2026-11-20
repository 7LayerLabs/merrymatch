import { ImageResponse } from "next/og";
import { GiftMark } from "./_mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<GiftMark size={180} />, size);
}
