import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const directory = "/tmp/finish-line-video";
await mkdir(directory, { recursive: true });
const subtitles = await readFile("docs/finish-line-demo.srt", "utf8");
const style = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 1000
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,0,0,0,0,100,100,0,0,3,1,0,2,40,40,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const events = subtitles
  .trim()
  .split(/\n\s*\n/)
  .map((block) => {
    const lines = block.split("\n");
    const times = lines[1]
      .split(" --> ")
      .map((time) =>
        time
          .replace(/^(\d\d):/, (_match, hour) => `${Number(hour)}:`)
          .replace(/,(\d\d)\d$/, ".$1"),
      );
    const caption = lines
      .slice(2)
      .join(" ")
      .replaceAll("\\", "")
      .replaceAll("{", "")
      .replaceAll("}", "");
    return `Dialogue: 0,${times[0]},${times[1]},Default,,0,0,0,,${caption}`;
  });
await writeFile(`${directory}/captions.ass`, style + events.join("\n") + "\n");
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  "docs/finish-line-demo.mp4",
  "-vf",
  `ass=${directory}/captions.ass`,
  "-c:v",
  "libx264",
  "-threads",
  "2",
  "-preset",
  "fast",
  "-crf",
  "24",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "copy",
  "-movflags",
  "+faststart",
  `${directory}/captioned.mp4`,
]);
await copyFile(`${directory}/captioned.mp4`, "docs/finish-line-demo.mp4");
const report = JSON.parse(await readFile("docs/video-check.json", "utf8"));
report.plannedSceneSeconds = report.durationSeconds;
report.durationSeconds = Number(
  execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      "docs/finish-line-demo.mp4",
    ],
    { encoding: "utf8" },
  ),
);
if (!(report.durationSeconds > 120 && report.durationSeconds < 180))
  throw new Error("Demo must remain under three minutes");
report.burnedInCaptions = true;
report.separateCaptions = "docs/finish-line-demo.srt";
report.captionTiming =
  "Proportional sentence estimates from actual offline narration durations; review before public upload.";
await writeFile(
  "docs/video-check.json",
  JSON.stringify(report, null, 2) + "\n",
);
