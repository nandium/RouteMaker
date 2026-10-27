import Foundation
import Lynx
import MapLibre
import os
import UIKit

private let log = Logger(subsystem: "rocks.routemaker.app", category: "map")

private struct GymLocation: Decodable {
    let id: String
    let name: String
    let address: String
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees

    var label: String {
        [name, address].filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

private struct MapScene: Decodable {
    let gyms: [GymLocation]
    let theme: String
    let style: URL
    let centerLatitude: CLLocationDegrees
    let centerLongitude: CLLocationDegrees
    let zoom: Double
    let locationZoom: Double
}

private final class GymAnnotation: MLNPointAnnotation {
    var gymID = ""
}

/// A 30pt disc with a 3pt ring in the page color, centered in a 44pt touch area.
private final class GymMarkerView: MLNAnnotationView {
    override init(reuseIdentifier: String?) {
        super.init(reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: 44, height: 44)
        backgroundColor = .clear
        scalesWithViewingDistance = false
        layer.shadowOpacity = 0.45
        layer.shadowRadius = 3
        layer.shadowOffset = CGSize(width: 0, height: 2)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func draw(_ rect: CGRect) {
        let ring = bounds.insetBy(dx: 4, dy: 4)
        UIColor.page.setFill()
        UIBezierPath(ovalIn: ring).fill()
        UIColor.marker.setFill()
        UIBezierPath(ovalIn: ring.insetBy(dx: 3, dy: 3)).fill()
    }
}

/// ReactLynx owns gym data and navigation; the host only renders the map.
@objcMembers
final class RouteMakerMapModule: RouteMakerModule, LynxModule {
    static var name: String { "RouteMakerMap" }

    static var methodLookup: [String: String] {
        ["open": NSStringFromSelector(#selector(open(_:completion:)))]
    }

    private var isOpen = false

    func open(_ sceneJSON: String, completion: @escaping LynxCallbackBlock) {
        DispatchQueue.main.async {
            guard !self.isOpen, let presenter = UIApplication.shared.topViewController else {
                completion("" as NSString)
                return
            }
            // The scene comes from our own JS, so a malformed one is a bug: log it and open nothing.
            let scene: MapScene
            do {
                scene = try JSONDecoder().decode(MapScene.self, from: Data(sceneJSON.utf8))
            } catch {
                log.warning("Rejected a malformed map scene: \(error.localizedDescription, privacy: .public)")
                completion("" as NSString)
                return
            }
            self.isOpen = true
            let map = RouteMakerMapViewController(scene: scene) { gymID in
                self.isOpen = false
                completion(gymID as NSString)
            }
            map.modalPresentationStyle = .fullScreen
            map.overrideUserInterfaceStyle = scene.theme == "dark" ? .dark : .light
            presenter.present(map, animated: true)
        }
    }
}

private final class RouteMakerMapViewController: UIViewController, MLNMapViewDelegate {
    private let scene: MapScene
    private let completion: (String) -> Void
    private let mapView: MLNMapView
    private var completed = false
    // The map centers on the first location fix unless the user has moved it already.
    private var followsFirstFix = true

    init(scene: MapScene, completion: @escaping (String) -> Void) {
        self.scene = scene
        self.completion = completion
        self.mapView = MLNMapView(frame: .zero, styleURL: scene.style)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // From top to bottom: the page color behind the status bar, the toolbar, the map, and a
        // bar in the navigation color behind the home indicator.
        view.backgroundColor = .page
        let toolbar = makeToolbar()
        let bottomBar = UIView()
        bottomBar.backgroundColor = .nav
        for subview in [toolbar, mapView, bottomBar] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: safeArea.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mapView.topAnchor.constraint(equalTo: toolbar.bottomAnchor),
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mapView.bottomAnchor.constraint(equalTo: safeArea.bottomAnchor),
            bottomBar.topAnchor.constraint(equalTo: safeArea.bottomAnchor),
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        mapView.delegate = self
        // Reduced accuracy is all the map needs. The protocol marks this setter optional, hence `?`.
        mapView.locationManager.setDesiredAccuracy?(kCLLocationAccuracyReduced)
        mapView.showsUserLocation = true
        mapView.addAnnotations(scene.gyms.map { gym in
            let annotation = GymAnnotation()
            annotation.coordinate = CLLocationCoordinate2D(
                latitude: gym.latitude,
                longitude: gym.longitude
            )
            annotation.title = gym.name
            annotation.subtitle = gym.address
            annotation.gymID = gym.id
            return annotation
        })
        mapView.setCenter(
            CLLocationCoordinate2D(
                latitude: scene.centerLatitude,
                longitude: scene.centerLongitude
            ),
            zoomLevel: scene.zoom,
            animated: false
        )
    }

    // The toolbar grows with the system text size: it wraps its content below a minimum height.
    private func makeToolbar() -> UIView {
        let headline = UIConfigurationTextAttributesTransformer { attributes in
            var attributes = attributes
            attributes.font = .preferredFont(forTextStyle: .headline)
            return attributes
        }

        var close = UIButton.Configuration.plain()
        close.image = UIImage(systemName: "xmark")
        close.title = "Close"
        close.imagePadding = 6
        close.baseForegroundColor = .onNav
        close.titleTextAttributesTransformer = headline
        let closeButton = UIButton(configuration: close, primaryAction: UIAction { [weak self] _ in
            self?.finish("")
        })

        var gyms = UIButton.Configuration.filled()
        gyms.title = "Gyms"
        gyms.baseBackgroundColor = .onNav
        gyms.baseForegroundColor = .nav
        gyms.cornerStyle = .fixed
        gyms.background.cornerRadius = 6
        gyms.titleTextAttributesTransformer = headline
        let gymsButton = UIButton(configuration: gyms, primaryAction: UIAction { [weak self] _ in
            self?.showGyms()
        })
        gymsButton.isEnabled = !scene.gyms.isEmpty

        let titleLabel = UILabel()
        titleLabel.text = "Gym map"
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.textColor = .onNav
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let toolbar = UIView()
        toolbar.backgroundColor = .nav
        let row = UIStackView(arrangedSubviews: [closeButton, titleLabel, gymsButton])
        row.alignment = .center
        row.spacing = 8
        row.isLayoutMarginsRelativeArrangement = true
        row.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8)
        row.translatesAutoresizingMaskIntoConstraints = false
        toolbar.addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: toolbar.topAnchor),
            row.bottomAnchor.constraint(equalTo: toolbar.bottomAnchor),
            row.leadingAnchor.constraint(equalTo: toolbar.safeAreaLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: toolbar.safeAreaLayoutGuide.trailingAnchor),
            toolbar.heightAnchor.constraint(greaterThanOrEqualToConstant: 52),
            closeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            closeButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            gymsButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            gymsButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        return toolbar
    }

    private func showGyms() {
        let chooser = UIAlertController(title: "Choose a gym", message: nil, preferredStyle: .alert)
        for gym in gymsNearestFirst() {
            chooser.addAction(UIAlertAction(title: gym.label, style: .default) { _ in
                self.finish(gym.id)
            })
        }
        chooser.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(chooser, animated: true)
    }

    /// The scene's order when the user's location is not known (no permission, or no fix yet).
    private func gymsNearestFirst() -> [GymLocation] {
        guard let here = mapView.userLocation?.location else { return scene.gyms }
        func distance(_ gym: GymLocation) -> CLLocationDistance {
            CLLocation(latitude: gym.latitude, longitude: gym.longitude).distance(from: here)
        }
        return scene.gyms.sorted { distance($0) < distance($1) }
    }

    private func finish(_ gymID: String) {
        guard !completed else { return }
        completed = true
        dismiss(animated: true) {
            self.completion(gymID)
        }
    }

    func mapView(_ mapView: MLNMapView, viewFor annotation: MLNAnnotation) -> MLNAnnotationView? {
        // Anything else is the user-location dot, which keeps MapLibre's own view.
        guard annotation is GymAnnotation else { return nil }
        let marker = mapView.dequeueReusableAnnotationView(withIdentifier: "gym")
            ?? GymMarkerView(reuseIdentifier: "gym")
        marker.isAccessibilityElement = true
        marker.accessibilityLabel = annotation.title ?? nil
        marker.accessibilityTraits = .button
        return marker
    }

    func mapView(_: MLNMapView, didSelect annotation: MLNAnnotation) {
        if let gym = annotation as? GymAnnotation {
            finish(gym.gymID)
        }
    }

    func mapView(_: MLNMapView, regionWillChangeWith reason: MLNCameraChangeReason, animated _: Bool) {
        // Any user gesture stops the auto-centering; our own camera moves are `.programmatic`.
        let gestures: MLNCameraChangeReason = [
            .gesturePan, .gesturePinch, .gestureRotate, .gestureZoomIn, .gestureZoomOut,
            .gestureOneFingerZoom, .gestureTilt
        ]
        if !reason.isDisjoint(with: gestures) {
            followsFirstFix = false
        }
    }

    func mapView(_ mapView: MLNMapView, didUpdate userLocation: MLNUserLocation?) {
        guard followsFirstFix, let location = userLocation?.location else { return }
        followsFirstFix = false
        mapView.setCenter(
            location.coordinate,
            zoomLevel: scene.locationZoom,
            animated: true
        )
    }
}
