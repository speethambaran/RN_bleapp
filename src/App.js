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
  TextInput,
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
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const scannedDeviceIds = new Map();
  const [receivedData, setReceivedData] = useState([]);
  const [inputValue, setInputValue] = useState('');

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
    let BleManagerDidUpdateValueForCharacteristic =
      DeviceEventEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        ({value, peripheral, characteristic, service}) => {
          // Convert bytes array to string
          // console.log(value);
          setReceivedData(prev => [...prev, value]);
          // return value;
          // const bytes = new Uint8Array(value); // Example byte array
          // const decoder = new TextDecoder('utf-8');
          // const data = bytesToString(value);
          // console.log(`Received ${data} for characteristic ${characteristic}`);
        },
      );
    let stopListener = BleManagerEmitter.addListener(
      'BleManagerStopScan',
      () => {
        console.log('Scan is stoped.');
        setIsScanning(false);
        setBluetoothDevices(prev => {
          let newArray = prev;
          return newArray.filter(
            (item, index) => newArray.indexOf(item) === index,
          );
        });
      },
    );
    return () => {
      stopListener.remove();
      BleManagerDiscoverPeripheral.remove('BleManagerDiscoverPeripheral');
      BleManagerDidUpdateValueForCharacteristic.remove(
        'BleManagerDidUpdateValueForCharacteristic',
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

  const connectToPeripheral = async peripheral => {
    if (peripheral.connected) {
      await BleManager.disconnect(peripheral?.id);
      peripheral.connected = false;
      scannedDeviceIds.set(peripheral.id, peripheral);
      setBluetoothDevices(Array.from(scannedDeviceIds.values()));
      alert(`Disconnected from ${peripheral.name}`);
    } else {
      try {
        // 'E8:C4:AB:3B:69:B7',
        // '02366e80-cf3a-11e1-9ab4-0002a5d5c51b',
        // '340a1b80-cf4b-11e1-ac36-0002a7d5c51b',
        // '00002a37-0000-1000-8000-00805f9b34fb'
        // '2902',
        await BleManager.connect(peripheral?.id);
        await BleManager.retrieveServices(peripheral?.id);
        peripheral.connected = true;
        scannedDeviceIds.set(peripheral.id, peripheral);
        setBluetoothDevices(Array.from(scannedDeviceIds.values()));
        alert(`connected to ${peripheral.name}`);
        await BleManager.startNotification(
          peripheral?.id,
          '0000180d-0000-1000-8000-00805f9b34fb',
          '00002a37-0000-1000-8000-00805f9b34fb',
        );
      } catch (error) {
        console.log('error', error);
      }
    }
  };
  const writingToPeripheral = async () => {
    const peripheral = bluetoothDevices?.find(i => i?.connected);
    if (peripheral) {
      let dataToWrite = inputValue
        ? String(inputValue)?.split(',')?.map((i)=>Number(i))
        : [
            220, 1, 3, 2, 0, 0, 0, 0, 6, 4, 5, 0, 8, 0, 7, 8, 1, 1, 1, 1, 1, 1,
            1, 1, 8, 8, 3, 3, 3, 3, 3, 3, 3, 3, 9, 0, 44, 0, 0, 0, 0, 0, 43,
            255, 255, 255, 0, 0, 0, 0, 192, 212, 1, 0, 240, 73, 2, 0, 240, 73,
            2, 0, 170, 3, 13, 1, 211, 250, 232, 44, 226, 214, 255, 255, 183, 69,
            1, 0, 206, 153, 5, 0, 247, 0, 4, 0, 164, 113, 178, 63, 4, 0, 152, 0,
            1, 2, 3, 0, 3, 8, 40, 40, 0, 0, 0, 0, 0, 0, 5, 2, 1, 0, 6, 16, 13,
            14, 13, 15, 11, 10, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 7, 2, 1,
            0, 8, 2, 251, 0, 9, 2, 96, 39, 10, 2, 1, 16, 11, 2, 17, 7, 22, 6, 7,
            0, 96, 39, 96, 39, 23, 2, 120, 0, 14, 2, 1, 32, 15, 4, 39, 192, 43,
            192, 16, 4, 232, 3, 250, 0, 17, 2, 129, 0, 32, 2, 0, 0, 33, 2, 0, 1,
            18, 0, 4, 0, 0, 0, 0, 0, 19, 0, 4, 0,
          ];
      try {
        await BleManager?.writeWithoutResponse(
          peripheral?.id,
          '02366e80-cf3a-11e1-9ab4-0002a5d5c51b',
          '340a1b80-cf4b-11e1-ac36-0002a6d5c51b',
          dataToWrite,
        );
        console.log('Write Successfull', dataToWrite);
      } catch (error) {
        console.log('Write error', error);
      }
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
                {peripheral.connected ? 'Connected' : 'Not Connected'}
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
        {receivedData?.map((i, idx) => (
          <Text key={idx} style={{fontSize: 12, color: '#000', margin: 12}}>
            {JSON.stringify(i)}
          </Text>
        ))}
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
          <TextInput
            value={inputValue} placeholder='Enter string with comma seperate'
            onChangeText={t => setInputValue(t)}
            style={{borderWidth: 1, marginHorizontal: 25, borderRadius: 5, padding: 10}}
          />
          <TouchableOpacity
            activeOpacity={0.5}
            disabled={isScanning}
            style={isScanning ? styles?.buttonDStyle : styles?.buttonStyle}
            onPress={startScan}>
            <Text style={styles?.buttonTextStyle}>
              {isScanning ? 'Scanning...' : 'Scan Bluetooth Devices'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.5}
            disabled={isScanning}
            style={isScanning ? styles?.buttonDStyle : styles?.buttonStyle}
            onPress={writingToPeripheral}>
            <Text style={styles?.buttonTextStyle}>
              {isScanning ? 'Writing...' : 'Write to Bluetooth Device'}
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
  buttonDStyle: {
    backgroundColor: '#C0C0C0',
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
