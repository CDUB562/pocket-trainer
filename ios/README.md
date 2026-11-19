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
- [ ] **Field skills** (add Duck and goose hunting to a dog's goals): Single marks shows Clean / Needed help / No go; 2 of 3 clean moves the step up.
- [ ] **Sound ladder** (Skills, Tools, Gunshot): 5 plays, then Relaxed / Noticed / Startled; Startled drops 2 steps. Check the quiet steps are really quiet.
- [ ] **Gun conditioning:** a "Worried" stops the block and relocks the skill.
- [ ] **Whistle bar:** the sounds carry outdoors (a phone is quieter than a real whistle; it teaches the pattern).
- [ ] **Distance chip outdoors:** asks for location once, shows yards and accuracy.
- [ ] **A second dog:** switcher on Today, separate progress.

## App Store Connect

- **Name:** "Pocket Trainer" may already be taken; "Pocket Trainer: Dog Clicker" is a fallback.
- **Category:** Lifestyle (Reference also fits).
- **Privacy policy URL:** https://cdub562.github.io/pocket-trainer/privacy.html
- **Support URL:** https://cdub562.github.io/pocket-trainer/support.html
- **App Privacy:** "Data Not Collected". The app has no network code at all; location (for the Distance chip) and camera never leave the phone. `PocketTrainer/PrivacyInfo.xcprivacy` declares the two required-reason APIs it uses:
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
| `Catalog.json` | Every skill (52 in 6 tracks), the passport, breeds, sounds and seasons. Generated from the web app's `src/catalog.js` by `node ../tools/gen_catalog.js`; never edit by hand. |
| `CatalogData.swift` | Codable types that read `Catalog.json` |
| `Models.swift` | Saved data: settings, dogs, each dog's state. Lenient decoding, so old saves and backups always load. v1 saves migrate to the first dog. |
| `AppModel.swift` | The engine, a port of the web app's `src/app.js`: levels, prerequisites, proofing grid, spaced reviews, the planner (places, rest days, field days, sound ladder, seasons), puppy tools, backups |
| `Session.swift` | The running session: blocks, marks, field outcomes, rounds, the sound ladder, breaks, holds, undo, filing the session |
| `MarkerAudio.swift` | Low-latency sound: pre-rendered buffers, 4 running player nodes, whistles and sound-ladder sounds synthesized at launch, the recorded Yes |
| `Recorder.swift` | Back-camera filming with tap times saved beside each video |
| `Location.swift` | GPS distance for field reps, only while the Distance chip is on |
| `TodayView.swift`, `SkillsView.swift`, `OnboardingView.swift`, `TrainingView.swift`, `SettingsView.swift`, `ChargeView.swift`, `GuideView.swift`, `ReviewView.swift`, `Components.swift` | The screens |

Data is saved to `Application Support/state-v2.json`. The planner and level logic must stay in step with `src/app.js`: change both together.

## Rules worth keeping

- **Mark on touch-down, never on release.** Releasing adds 100 ms or more, and marker timing is the whole point of the app.
- **Every Yes plays a sound before doing anything else.** Keep `audio.play` first in `AppModel.mark`.
- **Days are local calendar days** (`AppModel.day`), not UTC.
- **Changing a step list:**
  1. Edit `MODULES` in `../index.html`.
  2. Rerun the generator.
  3. Saved progress is clamped on load, so shorter lists are safe.
