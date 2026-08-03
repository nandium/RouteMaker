package rocks.routemaker.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.location.LocationComponentActivationOptions
import org.maplibre.android.location.OnLocationCameraTransitionListener
import org.maplibre.android.location.engine.LocationEngineRequest
import org.maplibre.android.location.modes.CameraMode
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.PropertyFactory.circleColor
import org.maplibre.android.style.layers.PropertyFactory.circleRadius
import org.maplibre.android.style.layers.PropertyFactory.circleStrokeColor
import org.maplibre.android.style.layers.PropertyFactory.circleStrokeWidth
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

class RouteMakerMapActivity : Activity() {
    private lateinit var mapView: MapView
    private lateinit var scene: MapScene
    private var map: MapLibreMap? = null
    private var style: Style? = null
    private val dark get() = scene.theme == "dark"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        scene = parseScene(intent.getStringExtra(SCENE).orEmpty()) ?: run {
            finish()
            return
        }
        MapLibre.getInstance(this)

        mapView = MapView(this)
        mapView.onCreate(savedInstanceState)
        setContentView(FrameLayout(this).apply {
            addView(mapView, matchParent())
            addView(toolbar(), toolbarLayout())
            addView(hint(), hintLayout())
        })

        mapView.getMapAsync { map ->
            map.setStyle(scene.style) { style ->
                this.map = map
                this.style = style
                val features = scene.gyms.map { gym ->
                    Feature.fromGeometry(Point.fromLngLat(gym.longitude, gym.latitude)).apply {
                        addStringProperty(GYM_ID, gym.id)
                    }
                }
                style.addSource(GeoJsonSource(GYM_SOURCE, FeatureCollection.fromFeatures(features)))
                style.addLayer(
                    CircleLayer(GYM_LAYER, GYM_SOURCE).withProperties(
                        circleColor(if (dark) MARKER_DARK else MARKER_LIGHT),
                        circleRadius(9f),
                        circleStrokeColor(Color.WHITE),
                        circleStrokeWidth(3f),
                    ),
                )
                map.addOnMapClickListener { point ->
                    val gymId = map.queryRenderedFeatures(
                        map.projection.toScreenLocation(point),
                        GYM_LAYER,
                    ).firstOrNull()?.getStringProperty(GYM_ID)
                    if (gymId.isNullOrBlank()) {
                        false
                    } else {
                        finishWithGym(gymId)
                        true
                    }
                }
                map.cameraPosition = CameraPosition.Builder()
                    .target(LatLng(scene.centerLatitude, scene.centerLongitude))
                    .zoom(scene.zoom)
                    .build()
                requestLocation()
            }
        }
    }

    private fun requestLocation() {
        if (
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            showUserLocation()
            return
        }
        requestPermissions(
            arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION),
            LOCATION_PERMISSION_REQUEST,
        )
    }

    @SuppressLint("MissingPermission")
    private fun showUserLocation() {
        val currentMap = map ?: return
        val currentStyle = style ?: return
        val location = currentMap.locationComponent
        if (!location.isLocationComponentActivated) {
            val request = LocationEngineRequest.Builder(LOCATION_UPDATE_INTERVAL_MS)
                .setFastestInterval(LOCATION_UPDATE_INTERVAL_MS)
                .setPriority(LocationEngineRequest.PRIORITY_LOW_POWER)
                .build()
            location.activateLocationComponent(
                LocationComponentActivationOptions.builder(this, currentStyle)
                    .locationEngineRequest(request)
                    .useDefaultLocationEngine(true)
                    .build(),
            )
        }
        location.isLocationComponentEnabled = true
        // MapLibre dismisses tracking when the user pans, so location centers
        // the initial view without fighting later map exploration.
        location.setCameraMode(
            CameraMode.TRACKING,
            LOCATION_CAMERA_TRANSITION_MS,
            scene.locationZoom,
            null,
            null,
            object : OnLocationCameraTransitionListener {
                override fun onLocationCameraTransitionFinished(cameraMode: Int) {
                    if (currentMap.cameraPosition.zoom != scene.locationZoom) {
                        location.zoomWhileTracking(scene.locationZoom)
                    }
                }

                override fun onLocationCameraTransitionCanceled(cameraMode: Int) = Unit
            },
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (
            requestCode == LOCATION_PERMISSION_REQUEST &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        ) {
            showUserLocation()
        }
    }

    private fun toolbar() = LinearLayout(this).apply {
        gravity = Gravity.CENTER_VERTICAL
        orientation = LinearLayout.HORIZONTAL
        setPadding(dp(12), dp(8), dp(12), dp(8))
        background = rounded(if (dark) 0xEE17201D.toInt() else 0xEEF3F4EF.toInt())
        addView(Button(context).apply {
            text = "Close"
            setTextColor(if (dark) Color.WHITE else INK)
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener { finish() }
        })
        addView(TextView(context).apply {
            text = "Gym map"
            textSize = 18f
            setTextColor(if (dark) Color.WHITE else INK)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        addView(Button(context).apply {
            text = "Gyms"
            isEnabled = scene.gyms.isNotEmpty()
            setTextColor(if (dark) Color.WHITE else INK)
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener { showGyms() }
        })
    }

    private fun hint() = TextView(this).apply {
        text = "Tap a marker or choose Gyms above."
        textSize = 14f
        gravity = Gravity.CENTER
        setTextColor(if (dark) Color.WHITE else INK)
        setPadding(dp(16), dp(12), dp(16), dp(12))
        background = rounded(if (dark) 0xEE17201D.toInt() else 0xEEF3F4EF.toInt())
    }

    private fun showGyms() {
        AlertDialog.Builder(this)
            .setTitle("Choose a gym")
            .setItems(scene.gyms.map { it.label }.toTypedArray()) { _, index ->
                finishWithGym(scene.gyms[index].id)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun finishWithGym(gymId: String) {
        setResult(RESULT_OK, Intent().putExtra(GYM_ID, gymId))
        finish()
    }

    private fun rounded(color: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(14).toFloat()
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
    )

    private fun toolbarLayout() = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
        gravity = Gravity.TOP
        setMargins(dp(12), dp(12), dp(12), 0)
    }

    private fun hintLayout() = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
        gravity = Gravity.BOTTOM
        setMargins(dp(20), 0, dp(20), dp(24))
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onStart() {
        super.onStart()
        if (::mapView.isInitialized) mapView.onStart()
    }

    override fun onResume() {
        super.onResume()
        if (::mapView.isInitialized) mapView.onResume()
    }

    override fun onPause() {
        if (::mapView.isInitialized) mapView.onPause()
        super.onPause()
    }

    override fun onStop() {
        if (::mapView.isInitialized) mapView.onStop()
        super.onStop()
    }

    override fun onLowMemory() {
        super.onLowMemory()
        if (::mapView.isInitialized) mapView.onLowMemory()
    }

    override fun onDestroy() {
        if (::mapView.isInitialized) mapView.onDestroy()
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::mapView.isInitialized) mapView.onSaveInstanceState(outState)
    }

    companion object {
        const val SCENE = "scene"
        const val GYM_ID = "gymId"

        private const val LOCATION_PERMISSION_REQUEST = 42
        private const val LOCATION_CAMERA_TRANSITION_MS = 750L
        private const val LOCATION_UPDATE_INTERVAL_MS = 10_000L
        private const val INK = 0xFF17201D.toInt()
        private const val MARKER_LIGHT = 0xFF1261A0.toInt()
        private const val MARKER_DARK = 0xFF73B7E8.toInt()
        private const val GYM_SOURCE = "gyms"
        private const val GYM_LAYER = "gym-markers"

        private fun parseScene(value: String): MapScene? {
            val scene = runCatching { JSONObject(value) }.getOrNull() ?: return null
            val items = scene.optJSONArray("gyms") ?: JSONArray()
            val gyms = buildList {
                for (index in 0 until items.length()) {
                    val item = items.optJSONObject(index) ?: continue
                    val id = item.optString("id")
                    val name = item.optString("name").ifBlank { "Gym ${index + 1}" }
                    val address = item.optString("address")
                    val latitude = item.optDouble("latitude", Double.NaN)
                    val longitude = item.optDouble("longitude", Double.NaN)
                    if (id.isBlank() || !latitude.isFinite() || !longitude.isFinite()) {
                        continue
                    }
                    add(
                        GymLocation(
                            id,
                            listOf(name, address).filter { it.isNotBlank() }.joinToString(", "),
                            latitude,
                            longitude,
                        ),
                    )
                }
            }
            val style = scene.optString("style")
            val centerLatitude = scene.optDouble("centerLatitude", Double.NaN)
            val centerLongitude = scene.optDouble("centerLongitude", Double.NaN)
            val zoom = scene.optDouble("zoom", Double.NaN)
            val locationZoom = scene.optDouble("locationZoom", Double.NaN)
            if (
                style.isBlank() ||
                !centerLatitude.isFinite() ||
                !centerLongitude.isFinite() ||
                !zoom.isFinite() ||
                !locationZoom.isFinite()
            ) {
                return null
            }
            return MapScene(
                gyms,
                scene.optString("theme"),
                style,
                centerLatitude,
                centerLongitude,
                zoom,
                locationZoom,
            )
        }
    }

    data class MapScene(
        val gyms: List<GymLocation>,
        val theme: String,
        val style: String,
        val centerLatitude: Double,
        val centerLongitude: Double,
        val zoom: Double,
        val locationZoom: Double,
    )

    data class GymLocation(
        val id: String,
        val label: String,
        val latitude: Double,
        val longitude: Double,
    )
}
