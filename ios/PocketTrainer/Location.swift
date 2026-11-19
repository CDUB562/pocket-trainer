import CoreLocation

/// Distance for field work: tap to set the start spot, then the phone's GPS shows yards from it. Tap again to reset.
/// Location is used only while this is on, and never leaves the phone.
final class DistanceTracker: NSObject, ObservableObject, CLLocationManagerDelegate, @unchecked Sendable {
    @Published private(set) var yards: Int?
    @Published private(set) var accuracy: Int?
    @Published private(set) var active = false
    @Published var denied = false

    private let manager = CLLocationManager()
    private var origin: CLLocation?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func startOrReset() {
        if active { origin = nil; yards = nil; return }
        switch manager.authorizationStatus {
        case .denied, .restricted: denied = true; return
        case .notDetermined: manager.requestWhenInUseAuthorization()
        default: break
        }
        active = true; origin = nil; yards = nil
        manager.startUpdatingLocation()
    }

    func stop() {
        manager.stopUpdatingLocation()
        active = false; origin = nil; yards = nil; accuracy = nil
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last, l.horizontalAccuracy >= 0 else { return }
        DispatchQueue.main.async {
            guard self.active else { return }
            if self.origin == nil { self.origin = l }
            self.yards = Int((l.distance(from: self.origin ?? l) * 1.0936).rounded())
            self.accuracy = Int((l.horizontalAccuracy * 1.0936).rounded())
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        DispatchQueue.main.async {
            if status == .denied || status == .restricted { self.denied = true; self.stop() }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
