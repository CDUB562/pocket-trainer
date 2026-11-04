import SwiftUI
import UniformTypeIdentifiers

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var markerStatus = ""
    @State private var recordingMarker = false
    @State private var exporting = false
    @State private var importing = false
    @State private var pendingRestore: Data?
    @State private var confirmErase = false
    @State private var backupDoc = BackupDocument(data: Data())
    private let soundButtons: [(String, Sound)] = [("Yes", .yes), ("Catch", .toss), ("Keep going", .keep), ("Free", .free), ("Recall", .recall)]

    var body: some View {
        NavigationStack {
            Form {
                Section("Your dog") {
                    TextField("Name", text: $model.state.settings.dog)
                        .textInputAutocapitalization(.words)
                }

                Section {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                        ForEach(soundButtons, id: \.0) { item in
                            Button(item.0) { model.audio.play(item.1) }.buttonStyle(OutlineButtonStyle())
                        }
                    }
                    .padding(.vertical, 4)
                    VStack(alignment: .leading) {
                        Text("Volume \(Int(model.state.settings.volume * 100))%").monospacedDigit()
                        Slider(value: $model.state.settings.volume, in: 0.1...1, step: 0.05, onEditingChanged: { editing in
                            if !editing { model.audio.play(.yes) }
                        })
                        .tint(Theme.accent)
                    }
                    if model.state.settings.volume > 0.85 {
                        Text("Above 85% the marker is loud at close range. Fine outdoors; lower it indoors.").font(.footnote).foregroundStyle(Theme.muted)
                    }
                } header: { Text("Sounds") } footer: {
                    Text("Use the phone speaker. Bluetooth speakers and AirPods add up to 200 ms of delay.")
                }

                Section {
                    Button(recordingMarker ? "Listening… say \"Yes!\"" : "Record my own Yes") {
                        recordingMarker = true
                        markerStatus = ""
                        model.audio.recordCustom { msg in
                            recordingMarker = false
                            markerStatus = msg
                        }
                    }
                    .disabled(recordingMarker)
                    if model.audio.hasCustom {
                        Button("Use the built-in click") {
                            model.audio.clearCustom()
                            markerStatus = "Using the built-in click for Yes."
                        }
                    }
                    Text(markerStatus.isEmpty ? (model.audio.hasCustom ? "Using your recording for Yes." : "Using the built-in click for Yes.") : markerStatus)
                        .font(.footnote).foregroundStyle(Theme.muted)
                } header: { Text("Your own marker") } footer: {
                    Text("Tap, then say \"Yes!\" once, sharply. The app trims the silence so it plays instantly, and plays the identical take every time.")
                }

                Section("Feedback") {
                    Toggle("Vibrate on every mark", isOn: $model.state.settings.haptic)
                    Toggle("Flash the screen (deaf dogs)", isOn: $model.state.settings.flash)
                    Stepper("Daily treat budget: \(model.state.settings.budget)", value: $model.state.settings.budget, in: 0...500, step: 5)
                }
                .tint(Theme.accent)

                Section("Practice log") {
                    if model.state.history.isEmpty {
                        Text("Finished sessions show up here.").foregroundStyle(Theme.muted)
                    }
                    ForEach(model.state.history.prefix(12)) { h in
                        HStack {
                            Text(h.at, format: .dateTime.month(.abbreviated).day())
                            Text("· " + Catalog.module(h.module).name)
                            Spacer()
                            Text("\(h.marks) marks").foregroundStyle(Theme.muted)
                            Text(clock(h.secs)).foregroundStyle(Theme.muted)
                        }
                        .font(.subheadline).monospacedDigit()
                    }
                }

                Section("Help") {
                    faq("No sound", "Turn the volume up with the side buttons. Sound plays even with the silent switch on. If it's still quiet, close the app fully and open it again. Using your own recording? Switch back to the built-in click to rule it out.")
                    faq("The sound comes late", "Use the phone speaker. Bluetooth speakers and AirPods add up to 200 ms, enough to mark the wrong moment. The training screen warns you when Bluetooth is connected.")
                    faq("No vibration", "Check that \"Vibrate on every mark\" is on, and that System Haptics is on in the iPhone's Settings, Sounds & Haptics.")
                    faq("Record does nothing", "Allow the camera: iPhone Settings, Pocket Trainer, Camera. Filming stops if you leave the app or lock the phone; what was filmed is kept.")
                    faq("My dog isn't getting it", "Go back a step (‹ Easier), train in a quieter room, use better treats and keep sessions to 2 or 3 minutes. Aim for 8 or more rewards a minute. If Yes doesn't make your dog look up, do another round of Charge Yes.")
                    faq("Moving to a new phone", "Save a backup below, keep it in Files or iCloud Drive, then use Restore a backup on the new phone. Videos and your recorded Yes are not in the backup.")
                }

                Section {
                    Button("Save a backup") {
                        backupDoc = BackupDocument(data: model.backupData())
                        exporting = true
                    }
                    Button("Restore a backup") { importing = true }
                    Button("Erase everything and start over", role: .destructive) { confirmErase = true }
                } header: { Text("Your data") } footer: {
                    Text("Everything stays on this phone. Nothing is sent anywhere.\nVersion \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""))")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Settings")
            .onChange(of: model.state.settings.volume) { _, v in model.audio.volume = Float(v) }
            .fileExporter(isPresented: $exporting, document: backupDoc, contentType: .json,
                          defaultFilename: "pocket-trainer-backup-\(model.today)") { result in
                if case .success = result { model.toast("Backup saved.") }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                guard case .success(let url) = result else { return }
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { model.toast("Couldn't open that file."); return }
                pendingRestore = data
            }
            .alert("Replace everything on this phone with this backup?", isPresented: Binding(get: { pendingRestore != nil }, set: { if !$0 { pendingRestore = nil } })) {
                Button("Replace", role: .destructive) {
                    if let d = pendingRestore {
                        do { try model.restore(d); model.toast("Backup restored.") } catch { model.toast("That file isn't a Pocket Trainer backup.") }
                    }
                    pendingRestore = nil
                }
                Button("Cancel", role: .cancel) { pendingRestore = nil }
            }
            .confirmationDialog("Erase all progress, settings, videos and your dog's name? This can't be undone.", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Erase everything", role: .destructive) { model.eraseAll(); markerStatus = "" }
            }
        }
    }

    private func faq(_ q: String, _ a: String) -> some View {
        DisclosureGroup(q) {
            Text(a).font(.subheadline).foregroundStyle(Theme.muted).padding(.vertical, 4)
        }
        .tint(Theme.fg)
    }
}
