export const Platform = { OS: 'ios', select: (o) => o.ios ?? o.default };
export const Share = { share: async () => ({ action: 'sharedAction' }) };
export const Alert = { alert: () => {} };
export const useWindowDimensions = () => ({ width: 390, height: 844 });
