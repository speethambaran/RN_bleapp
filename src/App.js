import React, {useState, useEffect} from 'react';
import {
  Text,
  View,
  Platform,
  StatusBar,
  ScrollView,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  NativeModules,
  useColorScheme,
  TouchableOpacity,
  NativeEventEmitter,
  PermissionsAndroid,
  DeviceEventEmitter,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import DeviceInfo from 'react-native-device-info';
import {requestMultiple, PERMISSIONS} from 'react-native-permissions';

const BleManagerModule = NativeModules.BleManager;
const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);
const App = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };
  const peripherals = new Map();
  const [isScanning, setIsScanning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const scannedDeviceIds = new Map();

  const requestPermissions = async cb => {
    if (Platform.OS === 'android') {
      const apiLevel = await DeviceInfo.getApiLevel();

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires Location',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        cb(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const result = await requestMultiple([
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);

        const isGranted =
          result['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED;
        cb(isGranted);
      }
    } else {
      cb(true);
    }
  };

  const scanForDevices = () => {
    requestPermissions(isGranted => {});
  };

  useEffect(() => {
    // start bluetooth manager
    BleManager.start({showAlert: false, forceLegacy: true});
    scanForDevices();
    // turn on bluetooth if it is not on
    BleManager.enableBluetooth().then(() => {
      console.log('Bluetooth is turned on!');
    });
    let BleManagerDiscoverPeripheral = DeviceEventEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      peripheral => {
        if (peripheral.name && peripheral?.id) {
          const deviceId = peripheral.id;
          if (!scannedDeviceIds.has(peripheral?.id)) {
            scannedDeviceIds.set(deviceId, peripheral);
            setBluetoothDevices(Array.from(scannedDeviceIds.values()));
          }
        }
      },
    );
    let stopListener = BleManagerEmitter.addListener(
      'BleManagerStopScan',
      () => {
        setIsScanning(false);
        setBluetoothDevices(prev => {
          let newArray = prev;
          return newArray.filter(
            (item, index) => newArray.indexOf(item) === index,
          );
        });
        console.log('Scan is stopped');
      },
    );
    return () => {
      stopListener.remove();
      BleManagerDiscoverPeripheral.removeListener(
        'BleManagerDiscoverPeripheral',
      );
    };
  }, []);

  const startScan = () => {
    if (!isScanning) {
      setIsScanning(true);
      setBluetoothDevices([]);
      scannedDeviceIds.clear();
      BleManager.scan([], 10, false)
        .then(() => {
          console.log('Scanning...');
        })
        .catch(err => {
          console.error(err);
          setIsScanning(false);
        });
    }
  };

  const connectToPeripheral = peripheral => {
    if (peripheral.connected) {
      BleManager.disconnect(peripheral.id).then(() => {
        peripheral.connected = false;
        setConnected(false);
        alert(`Disconnected from ${peripheral.name}`);
      });
    } else {
      BleManager.connect(peripheral?.id, {
        autoconnect: true,
      })
        .then(() => {
          let peripheralResponse = scannedDeviceIds.get(peripheral.id);
          if (peripheralResponse) {
            peripheralResponse.connected = true;
            scannedDeviceIds.set(peripheral.id, peripheralResponse);
            setConnected(true);
            setBluetoothDevices(Array.from(scannedDeviceIds.values()));
          }
          alert('Connecting to ' + JSON.stringify(peripheral?.name));
          BleManager.retrieveServices(peripheral.id)
            .then(peripheralData => {
              console.log('Peripheral services:', peripheralData);
              alert('Device is Connected');
            })
            .catch(err => {
              console.log('ffff', err);
              alert(err);
            });
        })
        .catch(error => {
          console.log('errrrrrrr', error);
          alert(error);
        });
      /* Read current RSSI value */
      // setTimeout(() => {
      //   BleManager.retrieveServices(peripheral.id)
      //     .then(peripheralData => {
      //       console.log('Peripheral services:', peripheralData?.connected);
      //       alert('Device is Connected');
      //     })
      //     .catch(err => {
      //       console.log('ffff', err);
      //       alert(err);
      //     });
      // }, 1000);
    }
  };
  // render list of bluetooth devices
  const RenderItem = ({peripheral}) => {
    const color = peripheral.connected ? 'green' : '#fff';
    return (
      <>
        <Text
          style={{
            fontSize: 20,
            marginLeft: 10,
            marginBottom: 5,
            color: isDarkMode ? Colors.white : Colors.black,
          }}>
          Nearby Devices:
        </Text>
        <TouchableOpacity onPress={() => connectToPeripheral(peripheral)}>
          <View
            style={{
              backgroundColor: color,
              borderRadius: 5,
              paddingVertical: 5,
              marginHorizontal: 10,
              paddingHorizontal: 10,
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}>
              <Text
                style={{
                  fontSize: 18,
                  textTransform: 'capitalize',
                  color: peripheral.connected ? Colors.white : Colors.black,
                }}>
                {peripheral.name}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  textTransform: 'capitalize',
                  color: peripheral.connected ? Colors.white : Colors.black,
                }}>
                {peripheral?.connected ? 'Connected' : 'Not Connected'}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: color,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  fontSize: 14,
                  color: peripheral.connected ? Colors.white : Colors.black,
                }}>
                RSSI: {peripheral.rssi}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: peripheral.connected ? Colors.white : Colors.black,
                }}>
                ID: {peripheral.id}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </>
    );
  };
  return (
    <SafeAreaView style={[backgroundStyle, styles.mainBody]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        style={backgroundStyle}
        showsVerticalScrollIndicator
        contentContainerStyle={styles.mainBody}
        contentInsetAdjustmentBehavior="automatic">
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
            marginBottom: 40,
          }}>
          <View>
            <Text
              style={{
                fontSize: 30,
                textAlign: 'center',
                padding: 10,
                color: isDarkMode ? Colors.white : Colors.black,
              }}>
              React Native BLE Manager
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.5}
            style={styles.buttonStyle}
            onPress={startScan}>
            <Text style={styles.buttonTextStyle}>
              {isScanning ? 'Scanning...' : 'Scan Bluetooth Devices'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* list of scanned bluetooth devices */}
        <ScrollView showsVerticalScrollIndicator>
          {bluetoothDevices.map((device, idx) => (
            <View key={device?.id}>
              <RenderItem peripheral={device} />
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};
const windowHeight = Dimensions.get('window').height;
const styles = StyleSheet.create({
  mainBody: {
    flex: 1,
    justifyContent: 'center',
    height: windowHeight,
  },
  buttonStyle: {
    backgroundColor: '#307ecc',
    borderWidth: 0,
    color: '#FFFFFF',
    borderColor: '#307ecc',
    height: 40,
    alignItems: 'center',
    borderRadius: 30,
    marginLeft: 35,
    marginRight: 35,
    marginTop: 15,
  },
  buttonTextStyle: {
    color: '#FFFFFF',
    paddingVertical: 10,
    fontSize: 16,
  },
});
export default App;
