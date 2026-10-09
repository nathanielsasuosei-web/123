/** Domain types, mapped from database rows to camelCase for the UI. */

export type Beat = {
  id: number;
  slug: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  bpm: number | null;
  musicalKey: string;
  genre: string;
  audioUrl: string;
  audioName: string;
  audioSize: number;
  coverUrl: string;
  isPublished: boolean;
  createdAt: Date;
};

export type Video = {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  videoKind: "link" | "file";
  createdAt: Date;
};

export type OrderStatus = "PENDING" | "PAID" | "FAILED";

export type Order = {
  id: number;
  userId: number;
  username: string;
  userEmail: string;
  beatId: number;
  beatTitle: string;
  beatSlug: string;
  beatAudioUrl: string;
  beatAudioName: string;
  amount: string;
  currency: string;
  status: OrderStatus;
  channel: string;
  reference: string;
  downloadToken: string;
  downloadCount: number;
  paidAt: Date | null;
  createdAt: Date;
};

export type User = {
  id: number;
  username: string;
  email: string;
  role: "artist" | "producer";
  createdAt: Date;
};

export type OutboxMessage = {
  id: number;
  toEmail: string;
  subject: string;
  body: string;
  kind: string;
  provider: string;
  status: "captured" | "sent" | "failed";
  error: string;
  orderId: number | null;
  createdAt: Date;
};

export type Message = {
  id: number;
  artistId: number;
  senderId: number;
  senderRole: "artist" | "producer";
  senderName: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export type Conversation = {
  artistId: number;
  username: string;
  email: string;
  lastBody: string;
  lastAt: Date | null;
  unread: number;
};

export type MessageRow = {
  id: number;
  artist_id: number;
  sender_id: number;
  sender_role: "artist" | "producer";
  sender_name: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
};

export type ConversationRow = {
  artist_id: number;
  username: string;
  email: string;
  last_body: string | null;
  last_at: Date | null;
  unread: number;
};

export type BeatInput = {
  title: string;
  description: string;
  price: string;
  bpm: number | null;
  musicalKey: string;
  genre: string;
  audioUrl: string;
  audioName: string;
  audioSize: number;
  coverUrl: string;
  isPublished: boolean;
};

export type VideoInput = {
  title: string;
  description: string;
  videoUrl: string;
  videoKind: "link" | "file";
};

/** Row shapes as they come back from Postgres. */
export type BeatRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  bpm: number | null;
  musical_key: string;
  genre: string;
  audio_url: string;
  audio_name: string;
  audio_size: string | number;
  cover_url: string;
  is_published: boolean;
  created_at: Date;
};

export type VideoRow = {
  id: number;
  title: string;
  description: string;
  video_url: string;
  video_kind: "link" | "file";
  created_at: Date;
};

export type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: "artist" | "producer";
  created_at: Date;
};

export type OrderRow = {
  id: number;
  user_id: number;
  beat_id: number;
  amount: string;
  currency: string;
  status: OrderStatus;
  channel: string;
  reference: string;
  download_token: string;
  download_count: number;
  paid_at: Date | null;
  created_at: Date;
  username: string;
  user_email: string;
  beat_title: string;
  beat_slug: string;
  beat_audio_url: string;
  beat_audio_name: string;
};

export type OutboxRow = {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  kind: string;
  provider: string;
  status: "captured" | "sent" | "failed";
  error: string;
  order_id: number | null;
  created_at: Date;
};
