import Foundation
import Lynx
import MapLibre
import UIKit

private struct GymLocation: Decodable {
    let id: String
    let name: String
    let address: String
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
}

private struct MapScene: Decodable {
    let gyms: [GymLocation]
    let theme: String
    let style: String
    let centerLatitude: CLLocationDegrees
    let centerLongitude: CLLocationDegrees
    let zoom: Double
    let locationZoom: Double
}

@objcMembers
final class RouteMakerMapModule: NSObject, LynxModule {
    static var name: String { "RouteMakerMap" }

    static var methodLookup: [String: String] {
        ["open": NSStringFromSelector(#selector(open(_:completion:)))]
    }

    init(param: Any) {
        super.init()
    }

    override init() {
        super.init()
    }

    func open(_ sceneJSON: String, completion: @escaping LynxCallbackBlock) {
        guard
            let data = sceneJSON.data(using: .utf8),
            let scene = try? JSONDecoder().decode(MapScene.self, from: data),
            URL(string: scene.style) != nil
        else {
            completion("" as NSString)
            return
        }

        DispatchQueue.main.async {
            guard let presenter = RouteMakerPresentation.topViewController() else {
                completion("" as NSString)
                return
            }
            let map = RouteMakerMapViewController(scene: scene) { gymID in
                completion(gymID as NSString)
            }
            let navigation = UINavigationController(rootViewController: map)
            navigation.modalPresentationStyle = .fullScreen
            presenter.present(navigation, animated: true)
        }
    }
}

private final class RouteMakerMapViewController: UIViewController, MLNMapViewDelegate {
    private let scene: MapScene
    private let dark: Bool
    private let completion: (String) -> Void
    private var gymIDs: [ObjectIdentifier: String] = [:]
    private var completed = false
    private var centeredOnUser = false

    init(scene: MapScene, completion: @escaping (String) -> Void) {
        self.scene = scene
        self.dark = scene.theme == "dark"
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Gym map"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(close)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Gyms",
            style: .plain,
            target: self,
            action: #selector(showGyms)
        )
        navigationItem.rightBarButtonItem?.isEnabled = !scene.gyms.isEmpty
        navigationController?.navigationBar.overrideUserInterfaceStyle = dark ? .dark : .light

        let mapView = MLNMapView(
            frame: view.bounds,
            styleURL: URL(string: scene.style)
        )
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.locationManager.setDesiredAccuracy?(kCLLocationAccuracyReduced)
        mapView.showsUserLocation = true
        view.addSubview(mapView)

        let annotations = scene.gyms.map { gym -> MLNPointAnnotation in
            let annotation = MLNPointAnnotation()
            annotation.coordinate = CLLocationCoordinate2D(
                latitude: gym.latitude,
                longitude: gym.longitude
            )
            annotation.title = gym.name
            annotation.subtitle = gym.address
            gymIDs[ObjectIdentifier(annotation)] = gym.id
            return annotation
        }
        mapView.addAnnotations(annotations)
        mapView.setCenter(
            CLLocationCoordinate2D(
                latitude: scene.centerLatitude,
                longitude: scene.centerLongitude
            ),
            zoomLevel: scene.zoom,
            animated: false
        )
    }

    @objc private func close() {
        finish("")
    }

    @objc private func showGyms() {
        let chooser = UIAlertController(title: "Choose a gym", message: nil, preferredStyle: .alert)
        for gym in scene.gyms {
            chooser.addAction(UIAlertAction(title: gym.name, style: .default) { _ in
                self.finish(gym.id)
            })
        }
        chooser.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        present(chooser, animated: true)
    }

    private func finish(_ gymID: String) {
        guard !completed else { return }
        completed = true
        (navigationController ?? self).dismiss(animated: true) {
            self.completion(gymID)
        }
    }

    func mapView(_: MLNMapView, annotationCanShowCallout _: MLNAnnotation) -> Bool {
        true
    }

    func mapView(
        _: MLNMapView,
        shouldChangeFrom _: MLNMapCamera,
        to _: MLNMapCamera
    ) -> Bool {
        // A gesture means the user's chosen view now takes precedence over a
        // device-location update that may still be resolving.
        centeredOnUser = true
        return true
    }

    func mapView(_ mapView: MLNMapView, didUpdate userLocation: MLNUserLocation?) {
        guard !centeredOnUser, let location = userLocation?.location else { return }
        centeredOnUser = true
        mapView.setCenter(
            location.coordinate,
            zoomLevel: scene.locationZoom,
            animated: true
        )
    }

    func mapView(
        _: MLNMapView,
        rightCalloutAccessoryViewFor _: MLNAnnotation
    ) -> UIView? {
        UIButton(type: .detailDisclosure)
    }

    func mapView(
        _: MLNMapView,
        annotation: MLNAnnotation,
        calloutAccessoryControlTapped _: UIControl
    ) {
        finish(gymIDs[ObjectIdentifier(annotation)] ?? "")
    }
}
