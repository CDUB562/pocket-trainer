import SwiftUI

@main
struct PocketTrainerApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environmentObject(model.recorder)
                .environmentObject(model.gps)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.scenePhase) private var phase
    @State private var tab = "today"

    var body: some View {
        TabView(selection: $tab) {
            TodayView(tab: $tab)
                .tabItem { Label("Today", systemImage: "sun.max.fill") }.tag("today")
            SkillsView()
                .tabItem { Label("Skills", systemImage: "list.bullet") }.tag("skills")
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag("setup")
        }
        .tint(Theme.accent)
        .overlay(alignment: .bottomTrailing) {
            // The recall whistle is one press away on every screen.
            MarkerButton(label: "Play the recall whistle", action: { _ in model.recall() }) {
                Text("RECALL")
                    .font(.display(20)).tracking(1)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20).padding(.vertical, 14)
                    .background(Theme.toss, in: Capsule())
                    .shadow(color: .black.opacity(0.25), radius: 9, y: 6)
            }
            .padding(.trailing, 16).padding(.bottom, 64)
        }
        .appOverlays()
        .fullScreenCover(item: $model.route, onDismiss: { model.showPendingSummary() }) { route in
            Group {
                switch route {
                case .training: TrainingView()
                case .charge: ChargeView()
                }
            }
            .environmentObject(model)
            .environmentObject(model.recorder)
            .environmentObject(model.gps)
        }
        .sheet(isPresented: $model.showGuide, onDismiss: { model.root.guideSeen = true }) { GuideView() }
        .sheet(item: $model.showOnboarding) { d in OnboardingView(draft: d).environmentObject(model) }
        .sheet(item: $model.finished) { f in SummaryView(f: f).environmentObject(model) }
        .onChange(of: phase) { _, p in
            if p == .active { model.becameActive() }
        }
        .onAppear {
            if model.root.dogs.isEmpty { model.showOnboarding = Dog() }
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count { tab = args[i + 1] }
            if args.contains("-openTraining") { model.startSingle("stay") }
            if args.contains("-openHowto") { model.startSingle("sit"); DispatchQueue.main.asyncAfter(deadline: .now() + 1) { model.howtoOpen = true } }
            if args.contains("-openSound") { model.startSingle("snd:gun") }
            if args.contains("-openField") { model.startSingle("marks") }
            #endif
        }
    }
}
