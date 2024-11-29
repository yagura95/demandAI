// backend/server.js
const nodejs = require('nodejs-mobile-react-native');
const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Dependencies required for app building
const REQUIRED_DEPENDENCIES = [
  {
    name: 'Node.js',
    command: 'node --version',
    minVersion: 'v14.0.0',
  },
  {
    name: 'npm',
    command: 'npm --version',
    minVersion: '6.0.0',
  },
  {
    name: 'React Native CLI',
    command: 'react-native --version',
    minVersion: '0.63.0',
  },
  {
    name: 'Android SDK',
    command: 'sdkmanager --version',
    minVersion: '26.0.0',
  },
  {
    name: 'Java Development Kit',
    command: 'java -version',
    minVersion: '1.8.0',
  },
  {
    name: 'Docker',
    command: 'docker --version',
    minVersion: '20.0.0',
  }
];

// Check if a version string meets minimum requirement
function checkVersion(current, minimum) {
  const clean = (version) => version.replace(/[^\d.]/g, '');
  const currentParts = clean(current).split('.');
  const minimumParts = clean(minimum).split('.');
  
  for (let i = 0; i < minimumParts.length; i++) {
    const currentNum = parseInt(currentParts[i]) || 0;
    const minimumNum = parseInt(minimumParts[i]) || 0;
    if (currentNum > minimumNum) return true;
    if (currentNum < minimumNum) return false;
  }
  return true;
}

// Check all required dependencies
async function checkDependencies() {
  const missing = [];
  const outdated = [];

  for (const dep of REQUIRED_DEPENDENCIES) {
    try {
      const output = execSync(dep.command).toString();
      if (!checkVersion(output, dep.minVersion)) {
        outdated.push(`${dep.name} (current: ${output.trim()}, required: ${dep.minVersion})`);
      }
    } catch (error) {
      missing.push(dep.name);
    }
  }

  if (missing.length > 0 || outdated.length > 0) {
    throw new Error(
      'Missing or outdated dependencies:\n' +
      (missing.length > 0 ? `Missing: ${missing.join(', ')}\n` : '') +
      (outdated.length > 0 ? `Outdated: ${outdated.join(', ')}` : '')
    );
  }
}

// Create Docker container for app building
async function createBuildContainer(appDir) {
  const dockerfile = `
    FROM reactnative/android:latest

    # Install additional dependencies
    RUN apt-get update && apt-get install -y \\
        nodejs \\
        npm \\
        openjdk-11-jdk

    # Set up Android SDK
    ENV ANDROID_HOME /opt/android-sdk
    ENV PATH $PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

    WORKDIR /app
    COPY . .

    # Install app dependencies
    RUN npm install

    # Grant execute permission to gradlew
    RUN chmod +x android/gradlew
  `;

  fs.writeFileSync(path.join(appDir, 'Dockerfile'), dockerfile);

  await new Promise((resolve, reject) => {
    exec(
      `docker build -t app-builder .`,
      { cwd: appDir },
      (error) => error ? reject(error) : resolve()
    );
  });
}

// Build app in Docker container
async function buildInContainer(appDir) {
  return new Promise((resolve, reject) => {
    exec(
      `docker run --rm -v ${appDir}:/app app-builder \\
       /bin/bash -c "cd android && ./gradlew assembleRelease"`,
      (error) => error ? reject(error) : resolve()
    );
  });
}

// Create isolated environment for running the app
async function createAppContainer(appDir, appId) {
  const dockerfile = `
    FROM ubuntu:latest

    # Install Android environment
    RUN apt-get update && apt-get install -y \\
        android-tools-adb \\
        qemu-kvm \\
        libvirt-daemon-system \\
        libvirt-clients \\
        bridge-utils

    # Set up Android emulator
    ENV ANDROID_HOME /opt/android-sdk
    RUN mkdir -p $ANDROID_HOME/emulator

    # Create isolated user
    RUN useradd -m appuser
    USER appuser

    WORKDIR /app
    COPY ./android/app/build/outputs/apk/release/app-release.apk .

    # Run emulator and install app
    CMD ["bash", "-c", "\\
        emulator @test -no-window -no-audio & \\
        adb wait-for-device && \\
        adb install app-release.apk && \\
        adb shell monkey -p com.${appId} 1"]
  `;

  fs.writeFileSync(path.join(appDir, 'Dockerfile.run'), dockerfile);

  await new Promise((resolve, reject) => {
    exec(
      `docker build -t app-runner -f Dockerfile.run .`,
      { cwd: appDir },
      (error) => error ? reject(error) : resolve()
    );
  });
}

app.post('/generate-app', async (req, res) => {
  const { prompt } = req.body;
  const appId = `app_${Date.now()}`;
  const appDir = path.join(APPS_DIR, appId);

  try {
    // 1. Check dependencies first
    await checkDependencies();
    
    // 2. Generate app code
    const appCode = await generateAppCode(prompt);
    
    // 3. Create app directory and save files
    fs.mkdirSync(appDir, { recursive: true });
    await saveAppFiles(appDir, appCode);

    // 4. Create build container
    await createBuildContainer(appDir);

    // 5. Build APK in container
    await buildInContainer(appDir);

    // 6. Create runtime container
    await createAppContainer(appDir, appId);

    // 7. Run app in isolated environment
    await new Promise((resolve, reject) => {
      exec(
        `docker run --privileged -it app-runner`,
        (error) => error ? reject(error) : resolve()
      );
    });

    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ... rest of the server code ...
