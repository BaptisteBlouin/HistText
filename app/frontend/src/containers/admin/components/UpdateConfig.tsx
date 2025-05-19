import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Grid } from '@mui/material';

// Mocking config.json file fetch and save
const fetchConfig = async () => {
  // Replace with actual fetch logic if needed
  return {
    statsLevelOptions: ['All', 'Medium', 'None'],
    docLevelOptions: ['100', '500', '5000', '20000'],
  };
};

const saveConfig = async (updatedConfig: any) => {
  console.log('Saving Config:', updatedConfig);
  // Replace with actual save logic (e.g., API call)
};

const UpdateConfig: React.FC = () => {
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
    await saveConfig(config);
    alert('Configuration saved successfully!');
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
            value={config.statsLevelOptions.join(', ')}
            onChange={e =>
              setConfig({
                ...config,
                statsLevelOptions: e.target.value.split(',').map(v => v.trim()),
              })
            }
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Doc Level Options (comma-separated)"
            value={config.docLevelOptions.join(', ')}
            onChange={e =>
              setConfig({
                ...config,
                docLevelOptions: e.target.value.split(',').map(v => v.trim()),
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
