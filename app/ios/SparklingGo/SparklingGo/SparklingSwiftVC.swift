// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SwiftUI
import Sparkling

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

class SparklingLynxElement: SPKLynxElement {
    var lynxElementName: String

    var lynxElementClassName: AnyClass

    init(lynxElementName: String, lynxElementClassName: AnyClass) {
        self.lynxElementName = lynxElementName
        self.lynxElementClassName = lynxElementClassName
    }
}

struct SPKSwiftVC: UIViewControllerRepresentable {
    @State private var state_frame: CGRect
    private let systemTheme: String

    init(state_frame: CGRect = .zero, systemTheme: String) {
        self.state_frame = state_frame
        self.systemTheme = systemTheme
    }

    func makeUIViewController(context: Context) -> some UIViewController {
        let url = "hybrid://lynxview?bundle=.%2Fmain.lynx.bundle&hide_status_bar=1&hide_nav_bar=1"
        let context = SPKContext()
        var initialData: [String: Any] = [
            "apiBaseUrl": APIEndpoint.baseURL,
            "systemTheme": systemTheme
        ]
        if let preference = RouteMakerAppearance.preference {
            initialData["themePreference"] = preference
        }
        context.initialData = ["initial_data": initialData]
        let elements = SparklingLynxElement(lynxElementName: "input", lynxElementClassName: LynxInput.self)
        context.customUIElements = [elements]
        let vc = SPKRouter.create(withURL: url, context: context, frame: self.state_frame)
        let naviVC = UINavigationController(rootViewController: vc)
        return naviVC
    }

    func updateUIViewController(_ uiViewController: UIViewControllerType, context: Context) {

    }
}


struct DemoVC: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { geometry in
            SPKSwiftVC(
                state_frame: geometry.frame(in: .local),
                systemTheme: colorScheme == .dark ? "dark" : "light"
            )
        }

    }
}
