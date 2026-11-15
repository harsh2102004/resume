import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const rawUri = (
  process.env.MONGODB_URI ||
  "mongodb+srv://rudrapratap4519_db_user:harsh5519@cluster0.m6txk9l.mongodb.net"
).trim().replace(/\/$/, "");

const MONGODB_URI = rawUri.includes("/pulsecast")
  ? rawUri
  : `${rawUri}/pulsecast`;

const SAMPLE_VIDEOS = [
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d801"),
    title: "High-Throughput WebSocket Watch Party Architecture",
    description:
      "How to maintain sub-50ms synchronization across thousands of viewers in real-time rooms with drift compensation and heartbeat ping-pong.",
    videoFile: "https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
    duration: 30,
    views: 3895,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d800"),
    title: "Building Distributed Media Pipeline with Node.js & FFmpeg",
    description:
      "Deep dive into HTTP 206 chunking, resumable TUS protocol, background queue workers, and real-time streaming architecture.",
    videoFile: "https://vjs.zencdn.net/v/oceans.mp4",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
    duration: 46,
    views: 1241,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d802"),
    title: "Big Buck Bunny - 4K Open Source Benchmark Stream",
    description:
      "The classic Blender Foundation open animation benchmark used worldwide for stress testing multi-bitrate HLS and AV1/H.264 video decoding pipelines.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
    duration: 596,
    views: 8940,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d803"),
    title: "Tears of Steel - Sci-Fi VFX Pipeline & Transcoding",
    description:
      "Exploring color grading, storyboard sprite generation, and WebVTT cue tracking on high-action 60 FPS sci-fi footage.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    duration: 734,
    views: 6520,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d804"),
    title: "Sintel - 4K Fantasy Cinema Master Showcase",
    description:
      "An epic fantasy short animation demonstrating high dynamic range rendering, synchronized audio tracks, and real-time buffer management.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
    duration: 888,
    views: 12480,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d805"),
    title: "Elephants Dream - Surrealist 3D Rendering Pipeline",
    description:
      "A pioneering open movie testing complex machine sounds, spatial audio playback, and high-entropy video compression algorithms.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    duration: 653,
    views: 4310,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d806"),
    title: "Ultra HD Encoding Profile & Low-Latency Buffer Test",
    description:
      "Stress test demo verifying sub-second seek responsiveness, byte-range caching, and CDN edge delivery performance under heavy loads.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    duration: 15,
    views: 3120,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6ae4d54bfd09b1416dd7d807"),
    title: "High Bitrate Adaptive Bitrate Streaming Deep Dive",
    description:
      "An in-depth look at HLS manifest generation, multi-resolution ladder rendering (1080p, 720p, 480p, 360p), and BullMQ queue concurrency.",
    videoFile: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
    duration: 47,
    views: 5740,
    transcodingStatus: "COMPLETED",
    transcodeProgress: 100,
    isPublished: true,
  },
];

async function seed() {
  console.log("Connecting to MongoDB:", MONGODB_URI.replace(/:([^@]+)@/, ":****@"));
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;

  // Find or pick a creator owner
  let owner = await db.collection("users").findOne({ username: "harsh21" });
  if (!owner) {
    owner = await db.collection("users").findOne({});
  }
  const ownerId = owner ? owner._id : new mongoose.Types.ObjectId("6ae4b3937a3f24668b5d2f30");

  console.log(`Using owner ID ${ownerId} (${owner?.username || "default"})`);

  for (const videoData of SAMPLE_VIDEOS) {
    const doc = {
      ...videoData,
      owner: ownerId,
      localPath: "",
      hlsPath: "",
      storyboardVtt: "",
      qualities: [],
      fileSize: 0,
      mimeType: "video/mp4",
      updatedAt: new Date(),
    };

    const res = await db.collection("videos").updateOne(
      { _id: videoData._id },
      {
        $set: doc,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log(
      `✓ Video "${videoData.title.slice(0, 40)}..." (status: ${videoData.transcodingStatus}) - ${
        res.upsertedCount ? "Created" : "Updated"
      }`
    );
  }

  // Also ensure existing videos are marked COMPLETED so no "Processing... 0%" badge is shown
  const updatedAll = await db.collection("videos").updateMany(
    { transcodingStatus: "PENDING" },
    { $set: { transcodingStatus: "COMPLETED", transcodeProgress: 100 } }
  );
  if (updatedAll.modifiedCount > 0) {
    console.log(`Updated ${updatedAll.modifiedCount} pending videos to COMPLETED status.`);
  }

  const total = await db.collection("videos").countDocuments({});
  console.log(`Done! Total videos in database: ${total}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
