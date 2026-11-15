idf_component_register(SRCS "main.c" "dice_engine.c" "dice_ui.c"
    INCLUDE_DIRS "."
    REQUIRES esp_hw_support
    PRIV_REQUIRES bootloader_support)
