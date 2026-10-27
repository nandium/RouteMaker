package rocks.routemaker.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.IntentCompat
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

private const val EXTRA_SCENE = "scene"
private const val EXTRA_GYM_ID = "gymId"

/** Shows the map for a scene and returns the chosen gym's id, or null when it is dismissed. */
class PickGym : ActivityResultContract<MapScene, String?>() {
    override fun createIntent(context: Context, input: MapScene) =
        Intent(context, RouteMakerMapActivity::class.java).putExtra(EXTRA_SCENE, input)

    override fun parseResult(resultCode: Int, intent: Intent?) =
        if (resultCode == Activity.RESULT_OK) intent?.getStringExtra(EXTRA_GYM_ID) else null
}

class RouteMakerMapActivity : ComponentActivity() {
    private lateinit var scene: MapScene
    private lateinit var mapView: MapView
    private var map: MapLibreMap? = null

    private val locationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) showUserLocation()
        }

    private fun color(light: Int, dark: Int) = getColor(if (scene.dark) dark else light)
    private val page get() = color(R.color.background_light, R.color.background_dark)
    private val nav get() = color(R.color.nav_light, R.color.nav_dark)
    private val onNav get() = color(R.color.on_nav_light, R.color.on_nav_dark)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Only PickGym starts this activity, and it always supplies a scene.
        scene = checkNotNull(IntentCompat.getSerializableExtra(intent, EXTRA_SCENE, MapScene::class.java))
        // The page color shows through the top inset; the bottom bar below paints its own.
        enableEdgeToEdge(
            SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { scene.dark },
            SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)
        window.setBackgroundDrawable(ColorDrawable(page))

        mapView = MapView(this)
        mapView.onCreate(savedInstanceState)
        val screen = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(toolbar())
            addView(mapView, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        }
        setContentView(insetColumn(this, screen, View(this).apply { setBackgroundColor(nav) }))

        mapView.getMapAsync { map ->
            this.map = map
            map.addOnMapClickListener { point ->
                val gymId = gymAt(map, point)
                if (gymId != null) finishWithGym(gymId)
                gymId != null
            }
            map.setStyle(scene.style) { style ->
                addGymMarkers(style)
                map.cameraPosition = CameraPosition.Builder()
                    .target(LatLng(scene.centerLatitude, scene.centerLongitude))
                    .zoom(scene.zoom)
                    .build()
                showUserLocationIfAllowed()
            }
        }
    }

    private fun addGymMarkers(style: Style) {
        val features = scene.gyms.map { gym ->
            Feature.fromGeometry(Point.fromLngLat(gym.longitude, gym.latitude)).apply {
                addStringProperty(PROPERTY_GYM_ID, gym.id)
            }
        }
        style.addSource(GeoJsonSource(GYM_SOURCE, FeatureCollection.fromFeatures(features)))
        style.addLayer(
            CircleLayer(GYM_LAYER, GYM_SOURCE).withProperties(
                // A 30dp disc with a 3dp ring in the page color around it.
                circleColor(color(R.color.marker_light, R.color.marker_dark)),
                circleRadius(MARKER_RADIUS_DP),
                circleStrokeColor(page),
                circleStrokeWidth(MARKER_RING_DP),
            ),
        )
    }

    /** The id of the marker under [point]; the search area is a 44dp square, wider than the marker. */
    private fun gymAt(map: MapLibreMap, point: LatLng): String? {
        val touch = map.projection.toScreenLocation(point)
        val slop = dp(TAP_SLOP_DP).toFloat()
        val area = RectF(touch.x - slop, touch.y - slop, touch.x + slop, touch.y + slop)
        return map.queryRenderedFeatures(area, GYM_LAYER)
            .firstOrNull()?.getStringProperty(PROPERTY_GYM_ID)
    }

    private fun showUserLocationIfAllowed() {
        if (
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            showUserLocation()
        } else {
            locationPermission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
    }

    @SuppressLint("MissingPermission")
    private fun showUserLocation() {
        val map = map ?: return
        val style = map.style ?: return
        val location = map.locationComponent
        if (!location.isLocationComponentActivated) {
            val request = LocationEngineRequest.Builder(LOCATION_UPDATE_INTERVAL_MS)
                .setFastestInterval(LOCATION_UPDATE_INTERVAL_MS)
                .setPriority(LocationEngineRequest.PRIORITY_LOW_POWER)
                .build()
            location.activateLocationComponent(
                LocationComponentActivationOptions.builder(this, style)
                    .locationEngineRequest(request)
                    .build(),
            )
        }
        location.isLocationComponentEnabled = true
        // MapLibre drops TRACKING on pan, so this only centers the first view.
        location.setCameraMode(
            CameraMode.TRACKING,
            LOCATION_CAMERA_TRANSITION_MS,
            scene.locationZoom,
            null,
            null,
            object : OnLocationCameraTransitionListener {
                override fun onLocationCameraTransitionFinished(cameraMode: Int) {
                    location.zoomWhileTracking(scene.locationZoom)
                }

                override fun onLocationCameraTransitionCanceled(cameraMode: Int) = Unit
            },
        )
    }

    // The toolbar grows with the system text size: it wraps its content below a minimum height.
    private fun toolbar() = LinearLayout(this).apply {
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(52)
        setPadding(dp(8), 0, dp(8), 0)
        setBackgroundColor(nav)
        addView(ImageButton(context).apply {
            setImageResource(R.drawable.ic_close)
            imageTintList = ColorStateList.valueOf(onNav)
            contentDescription = getString(R.string.map_close)
            setBackgroundColor(Color.TRANSPARENT)
            minimumWidth = dp(MIN_TOUCH_DP)
            minimumHeight = dp(MIN_TOUCH_DP)
            setOnClickListener { finish() }
        })
        addView(TextView(context).apply {
            setText(R.string.map_title)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(onNav)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        addView(Button(context).apply {
            setText(R.string.map_gyms)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTypeface(typeface, Typeface.BOLD)
            isAllCaps = false
            setTextColor(nav)
            background = GradientDrawable().apply {
                setColor(onNav)
                cornerRadius = dp(6).toFloat()
            }
            minHeight = dp(MIN_TOUCH_DP)
            minWidth = dp(MIN_TOUCH_DP)
            setPadding(dp(14), 0, dp(14), 0)
            isEnabled = scene.gyms.isNotEmpty()
            alpha = if (isEnabled) 1f else DISABLED_ALPHA
            setOnClickListener { showGyms() }
        })
    }

    private fun showGyms() {
        val dialogTheme = if (scene.dark) {
            android.R.style.Theme_DeviceDefault_Dialog_Alert
        } else {
            android.R.style.Theme_DeviceDefault_Light_Dialog_Alert
        }
        val gyms = gymsNearestFirst()
        AlertDialog.Builder(this, dialogTheme)
            .setTitle(R.string.map_choose_gym)
            .setItems(gyms.map { it.label }.toTypedArray()) { _, index ->
                finishWithGym(gyms[index].id)
            }
            .setNegativeButton(R.string.map_cancel, null)
            .show()
    }

    /** The scene's order when the user's location is not known (no permission, or no fix yet). */
    private fun gymsNearestFirst(): List<GymLocation> {
        val location = map?.locationComponent
            ?.takeIf { it.isLocationComponentActivated }?.lastKnownLocation
            ?: return scene.gyms
        val here = LatLng(location.latitude, location.longitude)
        return scene.gyms.sortedBy { LatLng(it.latitude, it.longitude).distanceTo(here) }
    }

    private fun finishWithGym(gymId: String) {
        setResult(RESULT_OK, Intent().putExtra(EXTRA_GYM_ID, gymId))
        finish()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onStart() {
        super.onStart()
        mapView.onStart()
    }

    override fun onResume() {
        super.onResume()
        mapView.onResume()
    }

    override fun onPause() {
        mapView.onPause()
        super.onPause()
    }

    override fun onStop() {
        mapView.onStop()
        super.onStop()
    }

    override fun onLowMemory() {
        super.onLowMemory()
        mapView.onLowMemory()
    }

    override fun onDestroy() {
        mapView.onDestroy()
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        mapView.onSaveInstanceState(outState)
    }

    private companion object {
        const val LOCATION_CAMERA_TRANSITION_MS = 750L
        const val LOCATION_UPDATE_INTERVAL_MS = 10_000L
        const val MIN_TOUCH_DP = 44
        const val TAP_SLOP_DP = MIN_TOUCH_DP / 2
        const val MARKER_RADIUS_DP = 15f
        const val MARKER_RING_DP = 3f
        const val DISABLED_ALPHA = 0.45f
        const val GYM_SOURCE = "gyms"
        const val GYM_LAYER = "gym-markers"
        const val PROPERTY_GYM_ID = "gymId"
    }
}
