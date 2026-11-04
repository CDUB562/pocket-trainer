# Pocket Trainer for iPhone

A native SwiftUI app with no third-party dependencies. It is a dog-training clicker and coach: a tap-to-mark YES pad, 10 step-by-step skills that adjust the difficulty on their own, a daily plan, a recall whistle, and session filming with tap-timing review. It works fully offline and collects no data.

It is a rewrite of the web app in this repo (`../index.html`, live at https://cdub562.github.io/pocket-trainer/) and teaches the same steps.

## Build and run

1. Use Xcode 16 or newer. Open `PocketTrainer.xcodeproj`.
2. Select the PocketTrainer target, then go to Signing & Capabilities:
   - **Team:** your Apple Developer team.
   - **Bundle Identifier:** change the placeholder `com.pockettrainer.app` to one you own, for example `com.yourcompany.pockettrainer`.
3. Run it on a real iPhone. The camera and the haptics don't work in the simulator.

There are no packages, pods or build scripts. The project uses Xcode 16 folder sync, so any file you add to `PocketTrainer/` is compiled automatically.

The app targets iOS 17+ and runs on iPhone only, in portrait.

The GitHub Actions workflow `.github/workflows/ios.yml` builds it on every push and saves simulator screenshots as a run artifact.

## Test on a device before submitting

These need real hardware, and they are the reasons the app is native:

- [ ] **Tap-to-sound delay.** Tap the YES pad and listen: the click should feel instant. The sound fires on touch-down (`TouchDownArea`), and the audio engine runs with a 5 ms I/O buffer.
- [ ] **Silent switch on:** sound still plays. The audio session category is `.playback`.
- [ ] **Haptic tick on every mark.** You can turn it off in Settings.
- [ ] **Recording.** Tap Record, mark a few times, end the session. Then tap Today, Review the video and check:
  - The marks line up with the video.
  - The − Frame and + Frame buttons step one frame at a time.
  - Here reports a lag in ms.
- [ ] **Camera permission denied:** you get the alert with an Open Settings button.
- [ ] **Leave the app while recording:** the video is kept and can still be reviewed.
- [ ] **Record my own Yes** (Settings): asks for the microphone, records 2 seconds, then plays the trimmed take on every Yes.
- [ ] **Connect AirPods:** the training screen shows the Bluetooth delay warning.
- [ ] **Phone call or Siri mid-session:** sound comes back afterwards.
- [ ] **Force-quit mid-session, then reopen:** the session appears in Settings, Practice log.
- [ ] **Save a backup, Erase everything, Restore a backup:** everything comes back except videos and the recorded Yes.

## App Store Connect

- **Name:** "Pocket Trainer" may already be taken; "Pocket Trainer: Dog Clicker" is a fallback.
- **Category:** Lifestyle (Reference also fits).
- **Privacy policy URL:** https://cdub562.github.io/pocket-trainer/privacy.html
- **Support URL:** https://cdub562.github.io/pocket-trainer/support.html
- **App Privacy:** "Data Not Collected". The app has no network code at all. `PocketTrainer/PrivacyInfo.xcprivacy` declares the two required-reason APIs it uses:
  - File timestamps: pruning old videos.
  - System uptime: timing taps against the video.
- **Export compliance:** no encryption. `ITSAppUsesNonExemptEncryption = NO` is already set.
- **Age rating:** 4+.
- **Screenshots:** take them on a 6.9" iPhone (16 Pro Max) or that simulator. Debug builds accept launch arguments that fill in sample data:
  - `-demo`
  - `-demo -tab skills`
  - `-demo -tab setup`
  - `-demo -openTraining`
- **Review notes:** "No login. Tap Today, Start to train. Camera is used only when the user taps Record on the training screen; microphone only for Settings, Record my own Yes."

## Where things are

| File | What it does |
| --- | --- |
| `PocketTrainerApp.swift` | App entry, tabs, the Recall button on every screen, full-screen routes |
| `AppModel.swift` | All app logic: the Today plan, the push/stay/drop coaching after every 5 tries, sessions, hold timers, saving, crash recovery, backup and restore |
| `Models.swift` | Saved data. Decoding is lenient, so old saves and backups always load. Progress is clamped to the current step lists. |
| `Catalog.swift` | The 10 skills and their 58 steps. Generated from the web app by `node ../tools/gen_catalog.js`. |
| `MarkerAudio.swift` | Low-latency sound: pre-rendered buffers, 4 running player nodes, interruption handling, the recorded-Yes trim |
| `Recorder.swift` | Back-camera filming to `Documents/Videos` with tap times saved beside each video. Keeps the newest 6 videos; 10-minute cap. |
| `TrainingView.swift` | The training screen and the step how-to sheet |
| `TodayView.swift`, `SkillsView.swift`, `SettingsView.swift`, `ChargeView.swift`, `GuideView.swift`, `ReviewView.swift` | The other screens |

Data is saved to `Application Support/state.json`.

## Rules worth keeping

- **Mark on touch-down, never on release.** Releasing adds 100 ms or more, and marker timing is the whole point of the app.
- **Every Yes plays a sound before doing anything else.** Keep `audio.play` first in `AppModel.mark`.
- **Days are local calendar days** (`AppModel.day`), not UTC.
- **Changing a step list:**
  1. Edit `MODULES` in `../index.html`.
  2. Rerun the generator.
  3. Saved progress is clamped on load, so shorter lists are safe.
