// appGenerator.js
import React, { useState } from 'react';
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  View,
  Alert,
} from 'react-native';
import nodejs from 'nodejs-mobile-react-native';

const AppGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');

  // Initialize the backend service
  React.useEffect(() => {
    nodejs.start('backend/server.js');
    nodejs.channel.addListener('message', (msg) => {
      setStatus(msg.status);
    });
  }, []);

  const generateApp = async () => {
    try {
      setStatus('Starting app generation...');
      
      const response = await fetch('http://localhost:3000/generate-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert(
          'Success',
          'Your app has been generated and installed! Check your app drawer.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>AI App Generator</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Describe the app you want (e.g., 'a calculator with dark theme')"
        value={prompt}
        onChangeText={setPrompt}
        multiline
      />

      <TouchableOpacity 
        style={styles.button}
        onPress={generateApp}
      >
        <Text style={styles.buttonText}>Generate App</Text>
      </TouchableOpacity>

      {status ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
  },
});

export default AppGenerator;

// backend/server.js
const nodejs = require('nodejs-mobile-react-native');
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());

// Directory for generated apps
const APPS_DIR = path.join(__dirname, 'generated_apps');
if (!fs.existsSync(APPS_DIR)) {
  fs.mkdirSync(APPS_DIR, { recursive: true });
}

app.post('/generate-app', async (req, res) => {
  const { prompt } = req.body;
  const appId = `app_${Date.now()}`;
  const appDir = path.join(APPS_DIR, appId);

  try {
    // 1. Generate app code using AI
    const appCode = await generateAppCode(prompt);
    
    // 2. Create app directory and save files
    fs.mkdirSync(appDir, { recursive: true });
    await saveAppFiles(appDir, appCode);

    // 3. Setup React Native project
    await setupReactNative(appDir, appId);

    // 4. Build APK
    await buildAPK(appDir);

    // 5. Install APK
    await installAPK(appDir);

    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

async function generateAppCode(prompt) {
  // Here you would integrate with an AI service to generate the app code
  // This is a simplified example
  const code = {
    components: {
      'App.js': `
        // Generated app code based on prompt: ${prompt}
        import React from 'react';
        import { View, Text } from 'react-native';
        
        const App = () => {
          return (
            <View>
              <Text>Generated App</Text>
            </View>
          );
        };
        
        export default App;
      `
    },
    // Add other necessary files
  };
  
  return code;
}

async function saveAppFiles(appDir, appCode) {
  // Save generated files
  Object.entries(appCode.components).forEach(([filename, content]) => {
    fs.writeFileSync(path.join(appDir, filename), content);
  });
}

async function setupReactNative(appDir, appId) {
  return new Promise((resolve, reject) => {
    exec(
      `npx react-native init ${appId}`,
      { cwd: appDir },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function buildAPK(appDir) {
  return new Promise((resolve, reject) => {
    exec(
      'cd android && ./gradlew assembleRelease',
      { cwd: appDir },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function installAPK(appDir) {
  const apkPath = path.join(appDir, 'android/app/build/outputs/apk/release/app-release.apk');
  return new Promise((resolve, reject) => {
    exec(
      `adb install ${apkPath}`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

app.listen(port, () => {
  console.log(`App generator backend running on port ${port}`);
});
