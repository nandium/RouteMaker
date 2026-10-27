package rocks.routemaker.app

import android.content.Context
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.LinearLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Lays [content] inside the system bars, display cutout and keyboard. The window behind the
 * activity shows through the top inset; [bottomBar] paints the bottom one, keyboard included.
 */
fun insetColumn(context: Context, content: View, bottomBar: View) = LinearLayout(context).apply {
    orientation = LinearLayout.VERTICAL
    addView(content, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
    addView(bottomBar, LinearLayout.LayoutParams(MATCH_PARENT, 0))
    ViewCompat.setOnApplyWindowInsetsListener(this) { column, insets ->
        val types = WindowInsetsCompat.Type.systemBars() or
            WindowInsetsCompat.Type.displayCutout() or
            WindowInsetsCompat.Type.ime()
        val space = insets.getInsets(types)
        column.setPadding(space.left, space.top, space.right, 0)
        bottomBar.layoutParams.height = space.bottom
        bottomBar.requestLayout()
        WindowInsetsCompat.CONSUMED
    }
}
