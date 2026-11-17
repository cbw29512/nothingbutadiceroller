idf_component_register(SRCS "main.c" "dice_engine.c" "dice_controls.c" "dice_ui.c"
        "dice_layout.c" "dice_motion.c" "dice_shapes.c" "dice_mesh.c"
        "dice_project.c" "dice_label_fit.c" "dice_silhouette.c"
        "dice_face_values.c" "dice_mesh_painter.c" "dice_visuals.c" "dice_tray.c"
        "dice_results.c" "dice_nat_event.c" "dice_nat_fx.c" "dice_nat_tone.c"
        "dice_nat_sound.c" "dice_impact_audio.c" "dice_shake_policy.c"
        "dice_ui_boot.c"
        "dice_summary.c" "tab5_power.c" "tab5_power_policy.c" "tab5_power_diag.c" "tab5_power_widget.c" "tab5_recovery_policy.c" "tab5_power_recovery.c" "tab5_board_power.c"
        "dice_widgets.c" "dice_ui_layout.c" "orientation_policy.c" "dice_ui_footer.c" "orientation.c"
    INCLUDE_DIRS "."
    REQUIRES esp_hw_support
    PRIV_REQUIRES bootloader_support esp_timer)
