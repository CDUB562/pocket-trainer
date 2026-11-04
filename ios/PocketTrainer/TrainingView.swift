import SwiftUI
import UIKit

/// Full screen, no tabs: one line of what to mark, the try dots, a giant pad in the thumb zone, the other markers under it.
struct TrainingView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var recorder: Recorder
    let module: Module
    @State private var showHowto = false

    private var guided: Bool { !module.steps.isEmpty }
    private var progress: Progress { model.prog(module.id) }
    private var step: Step? { guided ? module.steps[progress.step] : nil }

    var body: some View {
        VStack(spacing: 12) {
            header
            if model.bluetooth {
                Label("Bluetooth audio adds delay. Mark with the phone speaker.", systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.bold)).foregroundStyle(Theme.warn)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let step { stepCard(step) }
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    if guided {
                        let last = Array(progress.reps.suffix(5))
                        ForEach(0..<5, id: \.self) { i in repDot(i < last.count ? last[i] : nil) }
                    }
                }
                Spacer()
                chip(recorder.isRecording ? "Recording" : "Record", color: recorder.isRecording ? Theme.miss : Theme.fg, dot: recorder.isRecording) {
                    model.toggleRecording()
                }
                chip("Recall", color: Theme.toss) { model.recall() }
            }
            pad
            markers
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.bg)
        .appOverlays()
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true   // keep the screen on while training
            model.audio.ensureRunning()
            openHowtoIfNew()
        }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .onChange(of: progress.step) { _, _ in openHowtoIfNew() }
        .sheet(isPresented: $showHowto) { HowtoView(module: module) }
        .alert("Camera is off for Pocket Trainer", isPresented: $model.cameraDenied) {
            Button("Open Settings") { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }
            Button("Not now", role: .cancel) {}
        } message: {
            Text("Filming needs the camera. Turn it on in Settings, then come back.")
        }
    }

    private func openHowtoIfNew() {
        guard guided else { return }
        if model.firstVisit("\(module.id):\(progress.step)") { showHowto = true }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 10) {
            Button { model.closeTraining() } label: {
                Image(systemName: "chevron.left").font(.title3.weight(.bold))
                    .frame(width: 44, height: 44)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line, lineWidth: 2))
            }
            .foregroundStyle(Theme.fg)
            .accessibilityLabel("End session")
            VStack(alignment: .leading, spacing: 0) {
                Text(module.name.uppercased()).font(.display(24)).lineLimit(1)
                Text(step.map { "Step \(progress.step + 1) of \(module.steps.count) · \($0.title)" + (progress.done ? " · done" : "") } ?? module.goal)
                    .font(.caption).foregroundStyle(Theme.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
            TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                let secs = model.session.map { Int(Date().timeIntervalSince($0.start)) } ?? 0
                let rate: Int? = model.session.flatMap { s in secs >= 10 ? Int((Double(s.marks) / (Double(secs) / 60)).rounded()) : nil }
                // Under ~8 rewards a minute beginners lose interest; past 3 minutes, end while the dog still wants more.
                let slow = rate.map { $0 < 8 && secs >= 30 } ?? false
                VStack(alignment: .trailing, spacing: 0) {
                    Text(clock(secs)).font(.display(24)).monospacedDigit().foregroundStyle(secs >= 180 ? Theme.warn : Theme.fg)
                    Text(model.session == nil ? "tap to start" : rate.map { "\($0) a minute" } ?? "\(model.session?.marks ?? 0) marks")
                        .font(.caption).monospacedDigit().foregroundStyle(slow ? Theme.warn : Theme.muted)
                }
            }
        }
    }

    // MARK: Step card (the coach shares its space, so the pad never moves)

    private func stepCard(_ s: Step) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 8) {
                (Text("YES ").font(.display(22)).foregroundColor(Theme.accent) + Text(s.mark.prefix(1).uppercased() + s.mark.dropFirst()).font(.title3.weight(.bold)))
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 16) {
                    Button("‹ Easier") { model.setStep(progress.step - 1) }.disabled(progress.step == 0)
                    Button("How to set up") { showHowto = true }
                    Button("Harder ›") { model.setStep(progress.step + 1) }.disabled(progress.step == module.steps.count - 1)
                }
                .font(.subheadline.weight(.bold)).tint(Theme.toss)
                if let range = s.hold {
                    Button { model.toggleHold() } label: {
                        TimelineView(.periodic(from: .now, by: 0.2)) { _ in
                            if let end = model.holdEnd {
                                Text("Holding… \(max(0, Int(end.timeIntervalSinceNow.rounded(.up)))) s  (tap to cancel)")
                            } else {
                                Text("Start hold (\(range.lowerBound) to \(range.upperBound) s)")
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
            }
            .padding(.vertical, 4)
            .opacity(model.coach == nil ? 1 : 0)

            if let c = model.coach {
                VStack(alignment: .leading, spacing: 10) {
                    Text(c.text).font(.body.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                    HStack {
                        ForEach(c.actions) { a in
                            Button(a.label) { model.coach = nil; a.run() }
                                .buttonStyle(OutlineButtonStyle(solid: a.solid, color: Theme.bg))
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
                Text(title).font(.subheadline.weight(.bold))
            }
            .padding(.horizontal, 12).frame(minHeight: 36)
            .foregroundStyle(color)
            .background(Theme.surface, in: Capsule())
            .overlay(Capsule().stroke(dot ? Theme.miss : color == Theme.fg ? Theme.line : color, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    // MARK: Pad and markers

    private var pad: some View {
        MarkerButton(label: "Mark: Yes", action: { t in model.mark(.yes, at: t) }) {
            VStack(spacing: 4) {
                Text("YES").font(.display(110)).minimumScaleFactor(0.5)
                Text(model.session == nil ? "Tap the moment it happens. Then treat." : "Tap, then treat.").font(.subheadline).opacity(0.85)
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
                    .padding(10)
                    .allowsHitTesting(false)
            }
        }
    }

    private var markers: some View {
        HStack(spacing: 8) {
            marker(.miss, "Miss", "no sound", Theme.miss)
            marker(.toss, "Catch", "treat thrown", Theme.toss)
            // Keep going only shows where it's useful, so the row stays at three big targets.
            if step?.keep == true || step?.hold != nil { marker(.keep, "Keep going", "no treat", Theme.keep) }
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
}

struct HowtoView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let module: Module
    @State private var confirmReset = false

    var body: some View {
        let p = model.prog(module.id), s = module.steps[p.step]
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    Text("\(module.name): \(s.title)".uppercased()).font(.display(28))
                    Spacer()
                    Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle())
                }
                (Text("YES ").font(.display(22)).foregroundColor(Theme.accent) + Text(s.mark.prefix(1).uppercased() + s.mark.dropFirst()).font(.title3.weight(.bold)))
                numbered(1, "Set up", s.setup)
                numbered(2, "Reward", s.reward)
                numbered(3, "Cue", module.cue)
                Text("Short rounds of 5 tries. Tap Miss when it doesn't happen; the app tells you when to move on or make it easier.")
                    .font(.subheadline).foregroundStyle(Theme.muted)
                Button("Start") { dismiss() }.buttonStyle(OutlineButtonStyle(solid: true))
                Button("Start this skill over from step 1") { confirmReset = true }
                    .font(.subheadline.weight(.bold)).foregroundStyle(Theme.miss)
            }
            .padding(16)
        }
        .background(Theme.bg)
        .confirmationDialog("Start \(module.name) over from step 1?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Start over", role: .destructive) { model.resetSkill(); dismiss() }
        }
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
