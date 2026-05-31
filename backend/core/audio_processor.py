try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except ImportError:
    pass

import numpy as np
import librosa
from scipy.ndimage import maximum_filter
from scipy.ndimage import binary_erosion

class AudioProcessor:
    def __init__(self, sample_rate=22050, fan_value=15):
        self.sample_rate = sample_rate
        self.fan_value = fan_value

    def get_peaks(self, file_path):
        y, sr = librosa.load(file_path, sr=self.sample_rate)
        y = librosa.util.normalize(y)
        stft_matrix = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
        spectrogram = librosa.amplitude_to_db(stft_matrix, ref=np.max)
        neighborhood_size = 20
        local_max = maximum_filter(spectrogram, size=neighborhood_size) == spectrogram
        background = spectrogram > -65
        eroded_background = binary_erosion(background, structure=np.ones((5, 5)))
        detected_peaks = local_max & eroded_background
        frequencies, times = np.where(detected_peaks)
        return list(zip(frequencies, times))

    def generate_hashes(self, peaks):
        hashes = []
        peaks = sorted(peaks, key=lambda x: x[1])
        for i in range(len(peaks)):
            for j in range(1, self.fan_value):
                if (i + j) < len(peaks):
                    freq1, time1 = peaks[i]
                    freq2, time2 = peaks[i + j]
                    time_delta = time2 - time1
                    if 0 <= time_delta <= 200: 
                        hash_value = f"{freq1}|{freq2}|{time_delta}"
                        hashes.append((hash_value, int(time1)))
        return hashes