// ... continuing from previous server.js

// Logging utility
const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`);
    nodejs.channel.post({ status: message });
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, error);
    nodejs.channel.post({ status: `Error: ${message}` });
  }
};

async function generateAppCode(prompt) {
  logger.info('Generating app code from prompt...');
  
  // This would typically integrate with an AI API like OpenAI
  // For now, we'll generate a basic calculator app as an example
  const basicCalculatorApp = {
    'App.js': `
      import React, { useState } from 'react';
      import {
        SafeAreaView,
        Text,
        TouchableOpacity,
        View,
        StyleSheet,
      } from 'react-native';

      const Calculator = () => {
        const [display, setDisplay] = useState('0');
        const [equation, setEquation] = useState('');

        const handleNumber = (num) => {
          setDisplay(display === '0' ? num : display + num);
          setEquation(equation + num);
        };

        const handleOperator = (operator) => {
          setDisplay('0');
          setEquation(equation + operator);
        };

        const calculateResult = () => {
          try {
            const result = eval(equation);
            setDisplay(result.toString());
            setEquation(result.toString());
          } catch (error) {
            setDisplay('Error');
            setEquation('');
          }
        };

        const clear = () => {
          setDisplay('0');
          setEquation('');
        };

        const Button = ({ title, onPress, isOperator }) => (
          <TouchableOpacity
            style={[styles.button, isOperator && styles.operatorButton]}
            onPress={onPress}
          >
            <Text style={styles.buttonText}>{title}</Text>
          </TouchableOpacity>
        );

        return (
          <SafeAreaView style={styles.container}>
            <View style={styles.display}>
              <Text style={styles.displayText}>{display}</Text>
            </View>
            <View style={styles.buttons}>
              <View style={styles.row}>
                <Button title="7" onPress={() => handleNumber('7')} />
                <Button title="8" onPress={() => handleNumber('8')} />
                <Button title="9" onPress={() => handleNumber('9')} />
                <Button title="÷" onPress={() => handleOperator('/')} isOperator />
              </View>
              <View style={styles.row}>
                <Button title="4" onPress={() => handleNumber('4')} />
                <Button title="5" onPress={() => handleNumber('5')} />
                <Button title="6" onPress={() => handleNumber('6')} />
                <Button title="×" onPress={() => handleOperator('*')} isOperator />
              </View>
              <View style={styles.row}>
                <Button title="1" onPress={() => handleNumber('1')} />
                <Button title="2" onPress={() => handleNumber('2')} />
                <Button title="3" onPress={() => handleNumber('3')} />
                <Button title="-" onPress={() => handleOperator('-')} isOperator />
              </View>
              <View style={styles.row}>
                <Button title="C" onPress={clear} />
                <Button title="0" onPress={() => handleNumber('0')} />
                <Button title="=" onPress={calculateResult} />
                <Button title="+" onPress={() => handleOperator('+')} isOperator />
              </View>
            </View>
          </SafeAreaView>
        );
      };

      const styles = StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#f5f5f5',
        },
        display: {
          flex: 2,
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          padding: 20,
        },
        displayText: {
          fontSize: 48,
          color: '#333',
        },
        buttons: {
          flex: 8,
          padding: 10,
        },
        row: {
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        button: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
          margin: 5,
          borderRadius: 10,
          elevation: 3,
        },
        operatorButton: {
          backgroundColor: '#007AFF',
        },
        buttonText: {
          fontSize: 24,
          color: '#333',
        },
      });

      export default Calculator;
    `,
    'package.json': `{
      "name": "GeneratedCalculator",
      "version": "1.0.0",
      "private": true,
      "scripts": {
        "android": "react-native run-android",
        "ios": "react-native run-ios",
        "start": "react-native start"
      },
      "dependencies": {
        "react": "18.2.0",
        "react-native": "0.72.0"
      }
    }`,
    'android/app/src/main/AndroidManifest.xml': `
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application
          android:name=".MainApplication"
          android:label="AI Calculator"
          android:icon="@mipmap/ic_launcher"
          android:roundIcon="@mipmap/ic_launcher_round"
          android:allowBackup="false"
          android:theme="@style/AppTheme">
          <activity
            android:name=".MainActivity"
            android:label="AI Calculator"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
              <action android:name="android.intent.action.MAIN" />
              <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
          </activity>
        </application>
      </manifest>
    `
  };

  return basicCalculatorApp;
}

async function saveAppFiles(appDir, appCode) {
  logger.info('Saving generated app files...');
  
  try {
    // Ensure all necessary directories exist
    Object.keys(appCode).forEach(filePath => {
      const fullPath = path.join(appDir, filePath);
      const dirPath = path.dirname(fullPath);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, appCode[filePath].trim());
    });
  } catch (error) {
    logger.error('Error saving app files:', error);
    throw new Error('Failed to save app files');
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message
  });
});

// Clean up resources when shutting down
process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  
  try {
    // Clean up Docker containers
    execSync('docker rm $(docker ps -aq) -f');
    // Clean up Docker images
    execSync('docker rmi $(docker images -q) -f');
    
    logger.info('Cleanup completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during cleanup:', error);
    process.exit(1);
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`App generator backend running on port ${port}`);
});
