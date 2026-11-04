import AVFoundation
import SwiftUI

/// Plays a filmed session with every tap on the timeline. Step to the moment the behavior really happened,
/// tap Here, and it measures how late (or early) the tap was.
@MainActor
final class ReviewPlayer: ObservableObject {
    let player: AVPlayer
    @Published var time: Double = 0
    @Published var duration: Double = 1
    @Published var playing = false
    private var observer: Any?

    init(url: URL) {
        player = AVPlayer(url: url)
        player.isMuted = true
        observer = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 60), queue: .main) { [weak self] t in
            Task { @MainActor in
                self?.time = t.seconds
                self?.playing = (self?.player.rate ?? 0) != 0
            }
        }
        Task {
            if let d = try? await AVURLAsset(url: url).load(.duration), d.seconds.isFinite, d.seconds > 0 { duration = d.seconds }
        }
    }

    func stopObserving() {
        if let observer { player.removeTimeObserver(observer) }
        observer = nil
        player.pause()
    }

    func seek(_ t: Double) {
        player.pause()
        let c = min(max(0, t), duration)
        time = c
        player.seek(to: CMTime(seconds: c, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    /// One real video frame back or forward.
    func step(_ frames: Int) {
        player.pause()
        if let item = player.currentItem, frames < 0 ? item.canStepBackward : item.canStepForward {
            item.step(byCount: frames)
        } else {
            seek(time + Double(frames) / 30)
        }
    }

    func playSlow(from t: Double?) {
        if player.rate != 0 { player.pause(); playing = false; return }
        if let t { seek(t) }
        player.rate = 0.25
        playing = true
    }
}

struct ReviewView: View {
    let name: String
    @Environment(\.dismiss) private var dismiss
    @StateObject private var rp: ReviewPlayer
    @State private var marks: [RecMark]
    @State private var index = -1
    @State private var lags: [Int: Int] = [:]
    @State private var info: String

    init(name: String) {
        self.name = name
        _rp = StateObject(wrappedValue: ReviewPlayer(url: Recorder.videoURL(name)))
        let m = Recorder.marks(name)
        _marks = State(initialValue: m)
        _info = State(initialValue: m.isEmpty
            ? "No marks in this video. Tap Yes while recording to see your timing here."
            : "\(m.count) marks. Jump to one, step frame by frame to the moment it really happened (rump on the floor, nose on the palm), then tap Here.")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("REVIEW").font(.display(30))
                    Spacer()
                    ShareLink(item: Recorder.videoURL(name)) { Image(systemName: "square.and.arrow.up") }
                        .buttonStyle(OutlineButtonStyle())
                        .accessibilityLabel("Save or share the video")
                    Button("Done") { dismiss() }.buttonStyle(OutlineButtonStyle())
                }
                ZStack(alignment: .topLeading) {
                    PlayerLayerView(player: rp.player)
                        .aspectRatio(9 / 16, contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: 420)
                        .background(Color.black)
                    if let near = marks.first(where: { abs($0.t - rp.time) < 0.07 }) {
                        Text(near.kind == "miss" ? "MISS" : "YES")
                            .font(.display(22)).foregroundStyle(Theme.accentInk)
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(near.kind == "miss" ? Theme.miss : Theme.accent, in: RoundedRectangle(cornerRadius: 8))
                            .padding(12)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16))
                timeline
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow {
                        Button("‹ Mark") { go(index < 0 ? 0 : index - 1) }
                        Button(rp.playing ? "Pause" : "Play slow") { rp.playSlow(from: index >= 0 ? max(0, marks[index].t - 1) : nil) }
                            .buttonStyle(OutlineButtonStyle(solid: true))
                        Button("Mark ›") { go(index + 1) }
                    }
                    GridRow {
                        Button("− Frame") { rp.step(-1) }
                        Button("Here") { here() }
                        Button("+ Frame") { rp.step(1) }
                    }
                }
                .buttonStyle(OutlineButtonStyle())
                Text(info).fixedSize(horizontal: false, vertical: true)
                if !lags.isEmpty {
                    let v = lags.values.sorted(), mid = v[v.count / 2]
                    Text("Checked \(v.count) mark\(v.count > 1 ? "s" : ""): typical \(mid >= 0 ? "+" : "")\(mid) ms. Within ±50 ms is camera timing noise.")
                        .font(.subheadline).monospacedDigit().foregroundStyle(Theme.muted)
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .onDisappear { rp.stopObserving() }
    }

    private var timeline: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 10).fill(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
                ForEach(Array(marks.enumerated()), id: \.offset) { i, m in
                    Rectangle().fill(m.kind == "miss" ? Theme.miss : Theme.accent)
                        .frame(width: i == index ? 5 : 3, height: i == index ? 40 : 28)
                        .offset(x: min(w, w * m.t / rp.duration) - (i == index ? 2.5 : 1.5))
                }
                Rectangle().fill(Theme.fg).frame(width: 2, height: 46)
                    .offset(x: min(w, w * rp.time / rp.duration) - 1)
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { g in rp.seek(g.location.x / w * rp.duration) })
        }
        .frame(height: 40)
        .accessibilityLabel("Timeline with your marks")
    }

    private func go(_ i: Int) {
        guard !marks.isEmpty else { return }
        index = min(max(0, i), marks.count - 1)
        let m = marks[index]
        rp.seek(m.t)
        let kind = m.kind == "miss" ? "Miss" : m.kind == "yes" ? "Yes" : m.kind.capitalized
        info = "Mark \(index + 1) of \(marks.count) (\(kind)). This frame is when you tapped. Step back to find the real moment, then tap Here."
    }

    private func here() {
        guard index >= 0 else { info = "Jump to a mark first, then find the real moment."; return }
        let lag = Int(((marks[index].t - rp.player.currentTime().seconds) * 1000).rounded())
        lags[index] = lag
        info = lag >= 0
            ? "You tapped \(lag) ms after the real moment. " + (lag <= 200 ? "Sharp." : lag <= 350 ? "Good." : "Late: watch for the start of the movement you want and tap as it completes.")
            : "You tapped \(-lag) ms before it happened: that marks the movement on its way, not the result. Wait for the finish."
    }
}

struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer
    func makeUIView(context: Context) -> PlayerUIView {
        let v = PlayerUIView()
        v.playerLayer.player = player
        v.playerLayer.videoGravity = .resizeAspect
        return v
    }
    func updateUIView(_ uiView: PlayerUIView, context: Context) {}

    final class PlayerUIView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }
}
