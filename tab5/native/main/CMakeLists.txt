idf_component_register(SRCS "main.c" "dice_engine.c" "dice_controls.c" "dice_ui.c"
        "dice_layout.c" "dice_shapes.c" "dice_visuals.c" "dice_tray.c"
        "dice_widgets.c" "dice_ui_layout.c" "orientation.c"
    INCLUDE_DIRS "."
    REQUIRES esp_hw_support
    PRIV_REQUIRES bootloader_support)
