import Lynx
import UIKit

// The Xcode target copies the bundle from app/dist, so run `npm run build` before building.
private let bundleName = "main.lynx.bundle"

/// The Dynamic Type multiplier: 1 at the default text size, larger when the user raises it.
private func currentFontScale() -> CGFloat {
    UIFontMetrics.default.scaledValue(for: 1)
}

final class RouteMakerLynxViewController: UIViewController {
    private let lynxView = LynxView { $0.fontScale = currentFontScale() }
    private var systemTheme: String

    init(systemTheme: String) {
        self.systemTheme = systemTheme
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // Lynx assigns the whole map, so every update carries every prop.
    private var globalProps: [String: Any] {
        [
            "apiBaseUrl": Bundle.main.apiBaseURL,
            "systemTheme": systemTheme,
            "fontScale": currentFontScale(),
            "reducedMotion": UIAccessibility.isReduceMotionEnabled,
            // "light", "dark", or "system" when the user has not chosen.
            "themePreference": RouteMakerAppearance.preference ?? "system"
        ]
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Lynx sits inside the safe area and above the keyboard, which keeps focused inputs in
        // view. The page color shows above it, and a bar in the navigation color fills what is
        // below it (the home-indicator area, or the keyboard's) so the tab bar flows into it.
        view.backgroundColor = .page
        let bottomBar = UIView()
        bottomBar.backgroundColor = .nav
        for subview in [lynxView, bottomBar] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(subview)
        }
        lynxView.enableAutoLayout = true
        let safeArea = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            lynxView.leadingAnchor.constraint(equalTo: safeArea.leadingAnchor),
            lynxView.trailingAnchor.constraint(equalTo: safeArea.trailingAnchor),
            lynxView.topAnchor.constraint(equalTo: safeArea.topAnchor),
            // With the keyboard hidden this is the bottom of the safe area.
            lynxView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.topAnchor.constraint(equalTo: lynxView.bottomAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let notifications = NotificationCenter.default
        notifications.addObserver(
            self, selector: #selector(enterBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
        notifications.addObserver(
            self, selector: #selector(enterForeground),
            name: UIApplication.willEnterForegroundNotification, object: nil)
        notifications.addObserver(
            self, selector: #selector(fontScaleChanged),
            name: UIContentSizeCategory.didChangeNotification, object: nil)
        notifications.addObserver(
            self, selector: #selector(publishGlobalProps),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)

        guard
            let file = Bundle.main.url(forResource: bundleName, withExtension: nil),
            let template = try? Data(contentsOf: file)
        else {
            fatalError("\(bundleName) is missing from the app bundle")
        }
        let loadMeta = LynxLoadMeta()
        loadMeta.url = bundleName
        loadMeta.binaryData = template
        loadMeta.globalProps = LynxTemplateData(dictionary: globalProps)
        lynxView.loadTemplate(loadMeta)
    }

    @objc private func enterBackground() {
        lynxView.onEnterBackground()
    }

    @objc private func enterForeground() {
        lynxView.onEnterForeground()
    }

    @objc private func fontScaleChanged() {
        lynxView.updateFontScale(currentFontScale())
        publishGlobalProps()
    }

    @objc private func publishGlobalProps() {
        lynxView.updateGlobalProps(with: globalProps)
    }

    func updateSystemTheme(_ value: String) {
        guard value != systemTheme else { return }
        systemTheme = value
        publishGlobalProps()
    }
}
