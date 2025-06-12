import React, { useState, useEffect } from "react";
import { Box, TextField, Button, Grid } from "@mui/material";
import { useNotification } from "../../../contexts/NotificationContext";

/**
 * Fetches the configuration for the update form.
 * Replace this logic with a real fetch from your backend or config file.
 */
const fetchConfig = async () => {
  return {
    statsLevelOptions: ["All", "Medium", "None"],
    docLevelOptions: ["100", "500", "5000", "20000"],
  };
};

/**
 * Saves the updated configuration.
 * Replace this logic with a real API call to persist the configuration.
 */
const saveConfig = async (updatedConfig: any) => {
  console.log("Saving Config:", updatedConfig);
};

/**
 * Simple configuration editor for updating stats and doc level options.
 * Loads the config, allows user to edit comma-separated values,
 * and triggers a save (with placeholder logic).
 */
const UpdateConfig: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      const data = await fetchConfig();
      setConfig(data);
      setLoading(false);
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      await saveConfig(config);
      showSuccess(
        "Configuration Saved", 
        "The configuration has been updated successfully.",
        "Changes will take effect immediately."
      );
    } catch (error) {
      showError(
        "Save Failed",
        "Failed to save configuration. Please try again.",
        "Check your network connection and permissions."
      );
    }
  };

  if (loading) {
    return <div>Loading Config...</div>;
  }

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <h3>Update Configuration</h3>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Stats Level Options (comma-separated)"
            value={config.statsLevelOptions.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                statsLevelOptions: e.target.value
                  .split(",")
                  .map((v) => v.trim()),
              })
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Doc Level Options (comma-separated)"
            value={config.docLevelOptions.join(", ")}
            onChange={(e) =>
              setConfig({
                ...config,
                docLevelOptions: e.target.value.split(",").map((v) => v.trim()),
              })
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save Config
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UpdateConfig;
