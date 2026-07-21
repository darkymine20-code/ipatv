let inMemoryDeviceId: string | null = null;

export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      if (inMemoryDeviceId) return inMemoryDeviceId;
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch (e) {
    console.warn("localStorage is not available, falling back to memory:", e);
    if (!inMemoryDeviceId) {
      inMemoryDeviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    return inMemoryDeviceId;
  }
}

export function setDeviceId(newId: string) {
  try {
    localStorage.setItem("device_id", newId);
  } catch (e) {
    console.warn("localStorage is not available, updating memory:", e);
  }
  inMemoryDeviceId = newId;
}
