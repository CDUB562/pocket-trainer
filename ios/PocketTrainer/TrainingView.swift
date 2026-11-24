import SwiftUI
import UIKit

/// Full screen, no tabs: what earns a Yes, the try dots, a giant pad (or field outcome buttons, the sound ladder, a break) in the thumb zone.
struct TrainingView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var recorder: Recorder
    @EnvironmentObject var gps: DistanceTracker

    var body: some View {
        let s = model.blockSkill, mode = model.mode
        VStack(spacing: 12) {
            header(s)
            if model.bluetooth {
                Label("Bluetooth audio adds delay. Mark with the phone speaker.", systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.bold)).foregroundStyle(Theme.warn).frame(maxWidth: .infinity, alignment: .leading)
            }
            if mode != "break" && (!s.steps.isEmpty || mode == "sound") { stepCard(s, mode) }
            chipsRow(s, mode)
            if s.whistle == true || AppModel.fieldTracks.contains(s.track) { whistleBar }
            switch mode {
            case "outcome": outcomes(s)
            case "sound": soundPanel
            case "break": breakPanel
            default: pad; markers(s)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.bg)
        .appOverlays()
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true; model.audio.ensureRunning() }   // keep the screen on while training
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .sheet(isPresented: $model.howtoOpen) { HowtoView().environmentObject(model) }
        .alert("Camera is off for Pocket Trainer", isPresented: $model.cameraDenied) {
            Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
            Button("Not now", role: .cancel) {}
        } message: { Text("Filming needs the camera. Turn it on in Settings, then come back.") }
        .alert("Location is off for Pocket Trainer", isPresented: $gps.denied) {
            Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
            Button("Not now", role: .cancel) {}
        } message: { Text("Distance needs your location, only while it's on. Turn it on in Settings, then come back.") }
    }

    // MARK: Header

    private func header(_ s: Skill) -> some View {
        HStack(spacing: 10) {
            Button { model.closeRun() } label: {
                Image(systemName: "chevron.left").font(.title3.weight(.bold)).frame(width: 44, height: 44)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line, lineWidth: 2))
            }
            .foregroundStyle(Theme.fg).accessibilityLabel("End session")
            VStack(alignment: .leading, spacing: 0) {
                Text(s.name.uppercased()).font(.display(24)).lineLimit(1).minimumScaleFactor(0.6)
                Text(subtitle(s)).font(.caption).foregroundStyle(Theme.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
            TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                let secs = model.run?.start.map { Int(Date().timeIntervalSince($0)) } ?? 0, marks = model.run?.marks ?? 0
                let rate: Int? = model.run?.start != nil && secs >= 10 ? Int((Double(marks) / (Double(secs) / 60)).rounded()) : nil
                // Under ~8 rewards a minute beginners lose interest; long sessions turn amber.
                let slow = rate.map { $0 < 8 && secs >= 30 } ?? false
                VStack(alignment: .trailing, spacing: 0) {
                    Text(clock(secs)).font(.display(24)).monospacedDigit()
                        .foregroundStyle(secs >= 60 * (2 + 3 * (model.run?.blocks.count ?? 1)) ? Theme.warn : Theme.fg)
                    Text(model.run?.start == nil ? "tap to start" : rate.map { "\($0) a minute" } ?? "\(marks) marks")
                        .font(.caption).monospacedDigit().foregroundStyle(slow ? Theme.warn : Theme.muted)
                }
            }
        }
    }

    private func subtitle(_ s: Skill) -> String {
        guard let r = model.run, let b = model.block else { return "" }
        let pre = r.blocks.count > 1 ? "\(r.i + 1) of \(r.blocks.count) · " : ""
        switch b.kind {
        case "learn": return pre + "Step \(model.prog(b.id).step + 1) of \(s.steps.count) · \(model.currentStep?.t ?? "")"
        case "proof": return pre + "Proofing"
        case "review": return pre + "Review"
        case "sound": return pre + "Step \(model.soundStep) of 10"
        case "break": return pre + "Break"
        case "free": return s.goal
        default: return pre + Catalog.levels[model.level(b.id)]
        }
    }

    // MARK: Step card (the coach shares its space, so the pad never moves)

    private func stepCard(_ s: Skill, _ mode: String) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 8) {
                let prefix = mode == "outcome" ? "GOAL " : mode == "sound" ? "HOW " : "YES "
                let color = mode == "outcome" ? Theme.keep : mode == "sound" ? Theme.toss : Theme.accent
                (Text(prefix).font(.display(22)).foregroundColor(color)
                 + Text(mode == "sound" ? "Play it, then hand a treat right away. Relaxed means still eating, ears soft." : model.markText).font(.title3.weight(.bold)))
                    .fixedSize(horizontal: false, vertical: true)
                if let b = model.block, mode != "sound" {
                    if b.kind != "learn" && !s.dims.isEmpty {
                        Text((b.kind == "proof" ? "Today's level: " : "At: ") + model.describe(s, b.lv)).font(.subheadline).foregroundStyle(Theme.muted)
                    }
                    HStack(spacing: 16) {
                        if b.kind == "learn" {
                            Button("‹ Easier") { model.setStep(model.prog(b.id).step - 1) }.disabled(model.prog(b.id).step == 0)
                        }
                        Button("How to set up") { model.howtoOpen = true }
                        if b.kind == "learn" {
                            Button("Harder ›") { model.setStep(model.prog(b.id).step + 1) }.disabled(model.prog(b.id).step == s.steps.count - 1)
                        }
                        if let r = model.run, r.i < r.blocks.count - 1 { Button("Next block ›") { model.nextBlock() } }
                    }
                    .font(.subheadline.weight(.bold)).tint(Theme.toss)
                    if let range = model.holdRange { holdButton(range) }
                }
            }
            .padding(.vertical, 4)
            .opacity(model.coach == nil ? 1 : 0)

            if let c = model.coach {
                VStack(alignment: .leading, spacing: 10) {
                    Text(c.text).font(.body.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                    HStack {
                        ForEach(c.actions) { a in
                            Button(a.label) { model.coach = nil; a.run() }.buttonStyle(OutlineButtonStyle(solid: a.solid, color: Theme.bg))
                        }
                    }
                }
                .foregroundStyle(Theme.bg)
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Theme.fg, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .frame(minHeight: 140, alignment: .topLeading)
    }

    private func holdButton(_ range: ClosedRange<Int>) -> some View {
        Button { model.toggleHold() } label: {
            TimelineView(.periodic(from: .now, by: 0.2)) { _ in
                if let end = model.holdEnd {
                    Text("Holding… \(max(0, Int(end.timeIntervalSinceNow.rounded(.up)))) s  (tap to cancel)")
                } else {
                    Text(range.lowerBound == range.upperBound ? "Start hold (\(range.lowerBound) s)" : "Start hold (\(range.lowerBound) to \(range.upperBound) s)")
                }
            }
            .font(.body.weight(.bold)).monospacedDigit()
            .padding(.horizontal, 14).frame(minHeight: 44)
            .foregroundStyle(model.holdEnd != nil ? Theme.surface : Theme.keep)
            .background(model.holdEnd != nil ? Theme.keep : .clear, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.keep, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    // MARK: Dots and chips

    private func chipsRow(_ s: Skill, _ mode: String) -> some View {
        HStack(spacing: 8) {
            if !s.steps.isEmpty && (mode == "marker" || mode == "outcome") {
                let size = model.roundSize(s)
                let all: [Bool] = model.block.map { b in b.kind == "learn" ? model.prog(b.id).reps : b.reps } ?? []
                let reps = Array(all.suffix(size))
                HStack(spacing: 6) { ForEach(0..<size, id: \.self) { i in repDot(i < reps.count ? reps[i] : nil) } }
            }
            Spacer(minLength: 0)
            if model.undoSnap != nil { chip("Undo", color: Theme.fg) { model.undo() } }
            if mode == "outcome" || s.whistle == true {
                chip(distanceLabel, color: Theme.fg) { gps.startOrReset() }
            }
            chip(recorder.isRecording ? "Recording" : "Record", color: recorder.isRecording ? Theme.miss : Theme.fg, dot: recorder.isRecording) { model.toggleRecording() }
            chip("Recall", color: Theme.toss) { model.recall() }
        }
    }

    private var distanceLabel: String {
        guard gps.active else { return "Distance" }
        guard let yd = gps.yards else { return "Finding you…" }
        return "\(yd) yd" + (gps.accuracy.map { acc in " ±\(acc)" } ?? "")
    }

    private func repDot(_ ok: Bool?) -> some View {
        ZStack {
            Circle().stroke(ok == true ? Theme.keep : ok == false ? Theme.miss : Theme.line, lineWidth: 2)
            if ok == true { Circle().fill(Theme.keep) }
            if ok == false { Capsule().fill(Theme.miss).frame(width: 12, height: 4) }
        }
        .frame(width: 20, height: 20)
        .accessibilityHidden(true)
    }

    private func chip(_ title: String, color: Color, dot: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if dot { Circle().fill(Theme.miss).frame(width: 9, height: 9) }
                Text(title).font(.subheadline.weight(.bold)).lineLimit(1)
            }
            .padding(.horizontal, 10).frame(minHeight: 36)
            .foregroundStyle(color)
            .background(Theme.surface, in: Capsule())
            .overlay(Capsule().stroke(dot ? Theme.miss : color == Theme.fg ? Theme.line : color, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    // Whistle bar: the three standard field whistles, logged on the video timeline.
    private var whistleBar: some View {
        HStack(spacing: 8) {
            Eyebrow("Whistle")
            ForEach(0..<3, id: \.self) { i in
                let ids = ["wsit", "wcome", "wturn"], names = ["Sit —", "Come ~~~", "Turn · ·"]
                MarkerButton(label: names[i] + " whistle", action: { t in model.audio.play(named: ids[i]); model.feedback(); model.recorder.addMark("whistle", at: t) }) {
                    Text(names[i]).font(.subheadline.weight(.bold)).lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 36).foregroundStyle(Theme.fg)
                        .background(Theme.surface, in: Capsule()).overlay(Capsule().stroke(Theme.line, lineWidth: 2))
                }
            }
        }
    }

    // MARK: Pad, markers, outcomes, sound, break

    private var pad: some View {
        MarkerButton(label: "Mark: Yes", action: { t in model.mark(.yes, at: t) }) {
            VStack(spacing: 4) {
                Text("YES").font(.display(110)).minimumScaleFactor(0.5)
                Text(model.run?.start == nil ? "Tap the moment it happens. Then treat." : "Tap, then treat.").font(.subheadline).opacity(0.85)
            }
            .foregroundStyle(Theme.accentInk)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 24))
        }
        .frame(minHeight: 160)
        .overlay(alignment: .topTrailing) {
            if recorder.isRecording {
                CameraPreview(session: recorder.session)
                    .frame(width: 105, height: 140)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accentInk, lineWidth: 2))
                    .padding(10).allowsHitTesting(false)
            }
        }
    }

    private func markers(_ s: Skill) -> some View {
        HStack(spacing: 8) {
            marker(.miss, "Miss", "no sound", Theme.miss)
            marker(.toss, "Catch", "treat thrown", Theme.toss)
            // Keep going only shows where it's useful, so the row stays at three big targets.
            if model.currentStep?.keep == true || model.holdRange != nil || (model.block?.kind != "learn" && s.proof?.dur != nil) {
                marker(.keep, "Keep going", "no treat", Theme.keep)
            }
            marker(.free, "Free", "release", Theme.fg)
        }
    }

    private func marker(_ kind: MarkKind, _ title: String, _ sub: String, _ color: Color) -> some View {
        MarkerButton(label: title, action: { t in model.mark(kind, at: t) }) {
            VStack(spacing: 2) {
                Text(title.uppercased()).font(.display(20)).lineLimit(1).minimumScaleFactor(0.7).foregroundStyle(color)
                Text(sub).font(.caption2).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(color, lineWidth: 2))
        }
    }

    private func outcomes(_ s: Skill) -> some View {
        let labels = s.outcomes ?? ["Clean", "Needed help", "No go"], subs = ["a clean rep", "you had to help", "didn't happen"]
        let colors = [Theme.keep, Theme.warn, Theme.miss]
        return VStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { i in
                MarkerButton(label: labels[i], action: { t in model.outcome(i, at: t) }) {
                    VStack(spacing: 2) {
                        Text(labels[i].uppercased()).font(.display(36)).minimumScaleFactor(0.6).foregroundStyle(colors[i])
                        Text(subs[i]).font(.subheadline).foregroundStyle(Theme.muted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(colors[i], lineWidth: 3))
                }
                .layoutPriority(i == 0 ? 1 : 0)
            }
        }
        .frame(minHeight: 200)
    }

    private var soundPanel: some View {
        let plays = model.block?.plays ?? 0
        return VStack(spacing: 8) {
            MarkerButton(label: "Play the sound", action: { _ in model.playLadder() }) {
                VStack(spacing: 4) {
                    Text("PLAY").font(.display(96)).minimumScaleFactor(0.5)
                    Text(plays < 5 ? "Plays: \(plays) of 5. A treat right after each one." : "Done: how was your dog?").font(.subheadline)
                }
                .foregroundStyle(Theme.accentInk)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 24))
            }
            .frame(minHeight: 160)
            HStack(spacing: 8) {
                rating("relaxed", "Relaxed", "kept eating", Theme.keep, enabled: plays >= 5)
                rating("noticed", "Noticed", "looked, recovered", Theme.toss, enabled: plays >= 5)
                rating("startled", "Startled", "stop now", Theme.miss, enabled: true)
            }
        }
    }

    private func rating(_ r: String, _ title: String, _ sub: String, _ color: Color, enabled: Bool) -> some View {
        Button { model.rateLadder(r) } label: {
            VStack(spacing: 2) {
                Text(title.uppercased()).font(.display(20)).foregroundStyle(color)
                Text(sub).font(.caption2).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(color, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .disabled(!enabled || model.block?.rated == true)
        .opacity(enabled ? 1 : 0.35)
    }

    private var breakPanel: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { _ in
            let left = max(0, Int((model.block?.breakEnd ?? Date()).timeIntervalSinceNow.rounded()))
            VStack(spacing: 10) {
                Eyebrow("Break")
                Text(clock(left)).font(.display(80)).monospacedDigit()
                Text((model.st.hot == model.today ? "Hot day: shade and water, and let them lie on cool ground. " : "Water and shade. Let your dog lie down and cool off. ") + "Quick paw check.")
                    .multilineTextAlignment(.center)
                Button("Skip break") { model.nextBlock() }.buttonStyle(OutlineButtonStyle(solid: true))
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Theme.line))
        }
    }
}

struct HowtoView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var confirmReset = false

    var body: some View {
        let s = model.blockSkill
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let step = model.currentStep {
                    HStack(alignment: .top) {
                        Text("\(s.name): \(step.t)".uppercased()).font(.display(28))
                        Spacer()
                        Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle())
                    }
                    StepAnimation(skill: s.id, step: model.currentStepIndex, dog: model.dog?.name ?? "")
                    (Text((s.isOutcome ? "GOAL " : "YES ")).font(.display(22)).foregroundColor(s.isOutcome ? Theme.keep : Theme.accent) + Text(model.markText).font(.title3.weight(.bold)))
                    numbered(1, "Set up", step.setup)
                    numbered(2, "Reward", step.reward)
                    numbered(3, "Cue", s.cue)
                    if let gear = s.gear, !gear.isEmpty { numbered(4, "Bring", gear.joined(separator: ", ")) }
                    Text(s.isOutcome ? "Rounds of 3 reps. Log each one as Clean, Needed help or No go; the app moves you on or makes it easier."
                         : "Short rounds of 5 tries. Tap Miss when it doesn't happen; the app tells you when to move on or make it easier.")
                        .font(.subheadline).foregroundStyle(Theme.muted)
                    Button("Start") { dismiss() }.buttonStyle(OutlineButtonStyle(solid: true))
                    Button("Start this skill over from step 1") { confirmReset = true }.font(.subheadline.weight(.bold)).foregroundStyle(Theme.miss)
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .confirmationDialog("Start \(s.name) over from step 1?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Start over", role: .destructive) { model.resetSkill(s.id); dismiss() }
        }
    }
}

/// After a session: time, marks, the rate, each skill's ring, and how the dog was.
struct SummaryView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let f: FinishedSession
    @State private var rated: String?

    var body: some View {
        let rate = f.secs >= 20 ? Int((Double(f.marks) / (Double(f.secs) / 60)).rounded()) : nil
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("NICE WORK").font(.display(30))
                HStack(alignment: .top) {
                    fig(clock(f.secs), "Time")
                    fig("\(f.marks)", "Marks")
                    fig(rate.map(String.init) ?? "–", "Per minute", warn: (rate ?? 99) < 8)
                }
                ForEach(f.rows.indices, id: \.self) { i in
                    let r = f.rows[i]
                    HStack(spacing: 12) {
                        RingView(id: r.id)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.name + (r.after > r.before ? " · now \(Catalog.levels[r.after])" : "")).font(.headline)
                                .foregroundStyle(r.after > r.before ? Theme.keep : Theme.fg)
                            Text("\(r.hits) of \(r.tries) right. \(r.next)").font(.subheadline).foregroundStyle(Theme.muted)
                        }
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line))
                }
                Text("HOW WAS YOUR DOG?").font(.display(19)).foregroundStyle(Theme.muted)
                HStack {
                    ForEach(["keen", "ok", "tired"], id: \.self) { r in
                        Chip(r == "ok" ? "OK" : r.capitalized, on: rated == r) { rated = r; model.rateSession(r) }
                    }
                }
                if f.field { Text("After the field: water and rest, then check paws, eyes and ears, and for ticks and burrs.").font(.subheadline).foregroundStyle(Theme.muted) }
                Text("A nap or quiet time now helps the session stick.").font(.subheadline).foregroundStyle(Theme.muted)
                Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle(solid: true))
            }
            .padding(16)
        }
        .background(Theme.bg)
    }

    private func fig(_ value: String, _ label: String, warn: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.display(30)).monospacedDigit().foregroundStyle(warn ? Theme.warn : Theme.fg)
            Eyebrow(label)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

func numbered(_ n: Int, _ title: String, _ text: String, color: Color = Theme.accent) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text("\(n)").font(.display(22)).foregroundStyle(color).frame(width: 22, alignment: .leading)
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.body.weight(.bold))
            Text(text).font(.body).fixedSize(horizontal: false, vertical: true)
        }
    }
}
