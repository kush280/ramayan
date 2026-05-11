import { useState, useRef, useEffect } from 'react';
import { Download, Image, Video, Loader2, Music, VolumeX } from 'lucide-react';
import { downloadImage, downloadVideo } from './utils/download';
import './App.css';

function App() {
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    audio.loop = true;

    const attemptPlay = () => {
      audio.play()
        .then(() => {
          setMusicStarted(true);
          removeListeners();
        })
        .catch(() => console.log("Autoplay blocked, waiting for interaction..."));
    };

    const removeListeners = () => {
      document.removeEventListener('click', attemptPlay);
      document.removeEventListener('keydown', attemptPlay);
      document.removeEventListener('touchstart', attemptPlay);
      document.removeEventListener('scroll', attemptPlay);
    };

    // 1. Try immediately
    attemptPlay();

    // 2. Add listeners for any possible user action
    document.addEventListener('click', attemptPlay);
    document.addEventListener('keydown', attemptPlay);
    document.addEventListener('touchstart', attemptPlay);
    document.addEventListener('scroll', attemptPlay);

    return () => removeListeners();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleDownloadImage = async () => {
    setShowDownloadMenu(false);
    setIsDownloadingImage(true);
    await downloadImage('invitation-card', 'ramayan_path_invitation.png');
    setIsDownloadingImage(false);
  };

  const handleDownloadVideo = async () => {
    setShowDownloadMenu(false);
    setIsDownloadingVideo(true);
    setVideoProgress(0);
    const audio = audioRef.current;
    await downloadVideo('invitation-card', 'ramayan_path_invitation', (progress) => {
      setVideoProgress(progress);
    }, audio ?? undefined);
    setIsDownloadingVideo(false);
  };

  const isProcessing = isDownloadingImage || isDownloadingVideo;

  return (
    <div className="app-container">
      <audio ref={audioRef} src="/music.mp3" preload="auto" />
      <div className="background-image" />
      <div className="bg-overlay" />

      {/* Top-right controls */}
      <div className="top-controls">
        <button className="icon-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <VolumeX size={17} /> : <Music size={17} />}
          {musicStarted && !isMuted && <span className="music-pulse" />}
        </button>

        <div className="download-wrapper" ref={menuRef}>
          <button
            className="icon-btn"
            onClick={() => !isProcessing && setShowDownloadMenu(v => !v)}
            disabled={isProcessing}
            title="Download"
          >
            {isProcessing ? <Loader2 size={17} className="spin" /> : <Download size={17} />}
          </button>

          {showDownloadMenu && (
            <div className="download-menu">
              <p className="download-menu-title">सहेजें</p>
              <button className="download-option" onClick={handleDownloadImage}>
                <Image size={15} /><span>Image (.png)</span>
              </button>
              <button className="download-option" onClick={handleDownloadVideo}>
                <Video size={15} /><span>Video with Music</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Page */}
      <div className="page-layout">

        <div className="side-panel">
          <div className="side-line" />
          <div className="side-mantras">
            <p>।। श्री राम जय राम जय जय राम ।।</p>
            <p>।। जय सिया राम ।।</p>
            <p>।। मंगल भवन अमंगल हारी ।।</p>
          </div>
          <div className="side-line" />
        </div>

        <div className="invitation-wrapper">
          <div id="invitation-card" className="invitation-card glass-panel">
            <div className="corner corner-tl" /><div className="corner corner-tr" />
            <div className="corner corner-bl" /><div className="corner corner-br" />

            <div className="card-ornament top-ornament">✦ &nbsp; ✦ &nbsp; ✦</div>
            <div className="om-symbol">ॐ</div>
            <h1 className="event-title">रामायण पाठ</h1>
            <h2 className="event-subtitle">निमंत्रण</h2>

            <div className="divider"><span className="divider-diya">🪔</span></div>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">प्रारंभ तिथि</span>
                <span className="detail-value">18 मई 2026, सोमवार</span>
              </div>
              <div className="detail-sep" />
              <div className="detail-item">
                <span className="detail-label">हवन एवं पूर्णाहुति</span>
                <span className="detail-value">19 मई 2026, मंगलवार</span>
                <span className="detail-sub">प्रातः 11:00 बजे</span>
              </div>
              <div className="detail-sep" />
              <div className="detail-item address-box">
                <span className="detail-label">📍 स्थान</span>
                <span className="detail-value">38क/192-1, त्रिवेणी नगर प्रथम</span>
                <span className="detail-sub">लखनऊ, उत्तर प्रदेश</span>
              </div>
            </div>

            <div className="invite-footer">
              <div className="invite-rule" />
              <p className="invite-text">आप सपरिवार सादर आमंत्रित हैं</p>
              <div className="invite-rule" />
            </div>

            <div className="card-ornament bottom-ornament">❋ &nbsp; ❋ &nbsp; ❋</div>
          </div>
        </div>

        <div className="side-panel">
          <div className="side-line" />
          <div className="side-mantras">
            <p>।। रामचरितमानस ।।</p>
            <p>।। सुन्दरकाण्ड पाठ ।।</p>
            <p>।। भगवान श्री राम की कृपा ।।</p>
          </div>
          <div className="side-line" />
        </div>

      </div>

      {isDownloadingVideo && (
        <div className="recording-overlay">
          <Loader2 size={52} className="spin overlay-icon" />
          <h2 className="overlay-title">वीडियो तैयार हो रहा है...</h2>
          <p className="overlay-sub">कृपया प्रतीक्षा करें ({videoProgress}%)</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${videoProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;