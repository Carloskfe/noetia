declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }

  type Handler = (state: NetInfoState) => void;

  const NetInfo: {
    addEventListener(handler: Handler): () => void;
    fetch(): Promise<NetInfoState>;
  };

  export default NetInfo;
}
