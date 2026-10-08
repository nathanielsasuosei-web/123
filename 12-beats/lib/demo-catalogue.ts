/**
 * Bundled demo catalogue.
 *
 * Used to seed a fresh database and to serve a read-only storefront when the app
 * runs somewhere without a database (for example Vercel before DATABASE_URL is set).
 *
 * Media lives in `public/demo` and is synthesised by `scripts/generate-demo-media.py`,
 * so nothing here is third-party audio.
 */

export type DemoBeat = {
  slug: string;
  title: string;
  description: string;
  price: string;
  bpm: number;
  musicalKey: string;
  genre: string;
  audioUrl: string;
  audioName: string;
  audioSize: number;
  coverUrl: string;
};

export type DemoVideo = {
  title: string;
  description: string;
  videoUrl: string;
  videoKind: "link" | "file";
};

export const DEMO_BEATS: DemoBeat[] = [
  {
    slug: "accra-nights",
    title: "Accra Nights",
    description:
      "Warm afrobeats groove built for late-night drives along the coast. Syncopated kicks, shaker layers and a soft pad that leaves plenty of room for a vocal.",
    price: "200.00",
    bpm: 102,
    musicalKey: "F# minor",
    genre: "Afrobeats",
    audioUrl: "/demo/beats/accra-nights.mp3",
    audioName: "accra-nights.mp3",
    audioSize: 119664,
    coverUrl: "/demo/covers/accra-nights.svg",
  },
  {
    slug: "trotro-anthem",
    title: "Trotro Anthem",
    description:
      "Afro-fusion bounce with a call-and-response pluck hook. Made for a chorus that everybody can shout back on the first listen.",
    price: "150.00",
    bpm: 110,
    musicalKey: "A minor",
    genre: "Afro-fusion",
    audioUrl: "/demo/beats/trotro-anthem.mp3",
    audioName: "trotro-anthem.mp3",
    audioSize: 111456,
    coverUrl: "/demo/covers/trotro-anthem.svg",
  },
  {
    slug: "harmattan",
    title: "Harmattan",
    description:
      "Dry-season trap: rolling 808s, crisp hats and a dark three-note melody. Space at the top for a rapper who likes to sit back on the beat.",
    price: "120.00",
    bpm: 140,
    musicalKey: "C# minor",
    genre: "Trap",
    audioUrl: "/demo/beats/harmattan.mp3",
    audioName: "harmattan.mp3",
    audioSize: 88992,
    coverUrl: "/demo/covers/harmattan.svg",
  },
  {
    slug: "highlife-sunset",
    title: "Highlife Sunset",
    description:
      "Bright highlife guitar figures over a laid-back kit. Every element is separated, so it works for a full song or a 15-second social cut.",
    price: "250.00",
    bpm: 118,
    musicalKey: "G major",
    genre: "Highlife",
    audioUrl: "/demo/beats/highlife-sunset.mp3",
    audioName: "highlife-sunset.mp3",
    audioSize: 104112,
    coverUrl: "/demo/covers/highlife-sunset.svg",
  },
  {
    slug: "midnight-in-osu",
    title: "Midnight In Osu",
    description:
      "Slow R&B with a wide pad, swung hats and a sub that moves gently. Best served with close-mic vocals and a lot of reverb.",
    price: "100.00",
    bpm: 88,
    musicalKey: "E minor",
    genre: "R&B",
    audioUrl: "/demo/beats/midnight-in-osu.mp3",
    audioName: "midnight-in-osu.mp3",
    audioSize: 137376,
    coverUrl: "/demo/covers/midnight-in-osu.svg",
  },
  {
    slug: "kpanlogo-drums",
    title: "Kpanlogo Drums",
    description:
      "Percussion-forward afro rhythm with tuned drum fills. Drop a topline on it for a festival record, or loop a section as an interlude.",
    price: "180.00",
    bpm: 96,
    musicalKey: "D minor",
    genre: "Afro percussion",
    audioUrl: "/demo/beats/kpanlogo-drums.mp3",
    audioName: "kpanlogo-drums.mp3",
    audioSize: 126576,
    coverUrl: "/demo/covers/kpanlogo-drums.svg",
  },
];

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    title: "Studio session: Accra Nights",
    description:
      "Placeholder entry — paste a YouTube or Vimeo link (or upload a file) in the producer admin and it plays right here on this page.",
    videoUrl: "",
    videoKind: "link",
  },
  {
    title: "Behind the beat: Harmattan",
    description: "Another placeholder. Video links and uploaded files both work; uploads stream from storage.",
    videoUrl: "",
    videoKind: "link",
  },
];
