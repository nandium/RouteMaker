import Foundation
import SwiftUI
import UIKit

private let systemThemeEvent = "routemaker:system-theme-change"

private enum APIEndpoint {
    private static let infoPlistKey = "ROUTEMAKER_API_BASE_URL"

    static var baseURL: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String,
              !value.isEmpty,
              !value.contains("$(")
        else {
            fatalError("ROUTEMAKER_API_BASE_URL must be configured in the app's build settings")
        }

        guard let url = URL(string: value), url.host != nil else {
            fatalError("ROUTEMAKER_API_BASE_URL must be a valid URL")
        }
#if !DEBUG
        guard url.scheme?.lowercased() == "https" else {
            fatalError("Release builds require an HTTPS ROUTEMAKER_API_BASE_URL")
        }
#endif
        return value
    }
}

final class RouteMakerTemplateProvider: NSObject, LynxTemplateProvider {
    func loadTemplate(withUrl url: String!, onComplete callback: LynxTemplateLoadBlock!) {
        guard let path = Bundle.main.path(forResource: url, ofType: "bundle") else {
            let error = NSError(
                domain: "rocks.routemaker",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Unable to locate \(url ?? "") in the app bundle"]
            )
            callback(nil, error)
            return
        }

        do {
            callback(try Data(contentsOf: URL(fileURLWithPath: path)), nil)
        } catch {
            callback(nil, error)
        }
    }
}

enum RouteMakerLynxRuntime {
    static let config: LynxConfig = {
        let config = LynxConfig(provider: RouteMakerTemplateProvider())
        config.register(RouteMakerSessionModule.self)
        config.register(RouteMakerShareModule.self)
        config.register(RouteMakerAppearanceModule.self)
        config.register(RouteMakerNavigationModule.self)
        config.register(RouteMakerMapModule.self)

        // These are the official XElement implementations. The input shadow
        // node is registered explicitly so layout can measure <input>.
        config.registerUI(LynxUIInput.self, withName: "input")
        config.registerShadowNode(LynxUIInputShadowNode.self, withName: "input")
        config.registerUI(LynxUISVG.self, withName: "svg")
        return config
    }()

    static func prepare() {
        LynxEnv.sharedInstance().prepareConfig(config)
    }
}

final class RouteMakerLynxViewController: UIViewController {
    private var systemTheme: String
    private var lynxView: LynxView?

    init(systemTheme: String) {
        self.systemTheme = systemTheme
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let viewSize = view.bounds.size == .zero ? UIScreen.main.bounds.size : view.bounds.size
        let lynxView = LynxView { builder in
            builder.config = RouteMakerLynxRuntime.config
            builder.screenSize = viewSize
            builder.fontScale = 1.0
        }
        lynxView.enableAutoLayout = true
        lynxView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(lynxView)
        NSLayoutConstraint.activate([
            lynxView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            lynxView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            lynxView.topAnchor.constraint(equalTo: view.topAnchor),
            lynxView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        self.lynxView = lynxView
        let notifications = NotificationCenter.default
        notifications.addObserver(
            self,
            selector: #selector(enterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        notifications.addObserver(
            self,
            selector: #selector(enterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )

        var globalProps: [String: Any] = [
            "apiBaseUrl": APIEndpoint.baseURL,
            "systemTheme": systemTheme
        ]
        if let preference = RouteMakerAppearance.preference {
            globalProps["themePreference"] = preference
        }
        let loadMeta = LynxLoadMeta()
        loadMeta.url = "main.lynx"
        loadMeta.globalProps = LynxTemplateData(dictionary: globalProps)
        lynxView.loadTemplate(loadMeta)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func enterBackground() {
        lynxView?.onEnterBackground()
    }

    @objc private func enterForeground() {
        lynxView?.onEnterForeground()
    }

    func updateSystemTheme(_ value: String) {
        guard value != systemTheme else { return }
        systemTheme = value
        lynxView?.sendGlobalEvent(systemThemeEvent, withParams: [value])
    }
}

struct RouteMakerHostView: UIViewControllerRepresentable {
    @Environment(\.colorScheme) private var colorScheme

    func makeUIViewController(context: Context) -> RouteMakerLynxViewController {
        RouteMakerLynxViewController(systemTheme: colorScheme == .dark ? "dark" : "light")
    }

    func updateUIViewController(_ viewController: RouteMakerLynxViewController, context: Context) {
        viewController.updateSystemTheme(colorScheme == .dark ? "dark" : "light")
    }
}
