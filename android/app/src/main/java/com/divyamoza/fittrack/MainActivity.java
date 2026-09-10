package com.divyamoza.fittrack;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Insets the WebView below the system bars.
 *
 * Android 15+ forces edge-to-edge for apps targeting SDK 35 and above, so the
 * WebView is laid out behind the status bar and the app's header ends up under
 * the clock. CSS cannot fix this: on Android `env(safe-area-inset-top)` only
 * reports display cutouts, not the status bar, so it stays 0 on most phones.
 *
 * Applying the system-bar insets as padding here restores the expected layout
 * while keeping the edge-to-edge background, and needs no extra plugin. The
 * web layer is untouched and still renders identically in a browser.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
