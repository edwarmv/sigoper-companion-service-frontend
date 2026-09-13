import { useEffect, useRef, useState, type ChangeEvent } from "react";
import QrScanner from "qr-scanner";
import "./App.css";
import { appRoute } from "./router";
import logoUrl from "./assets/sigoper-icon.png";

type Screen = "home" | "scanning" | "result";
type WsConnectionStatus = "connected" | "disconnected" | "connecting";

type ScannerError = {
  title: string;
  message: string;
};

const connectionLabels: Record<WsConnectionStatus, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  connecting: "Conectando...",
};

function getCameraError(error: unknown): ScannerError {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return {
        title: "El acceso a la cámara está bloqueado",
        message:
          "Permite el acceso a la cámara en la configuración del navegador e inténtalo de nuevo.",
      };
    }

    if (
      error.name === "NotFoundError" ||
      error.name === "OverconstrainedError"
    ) {
      return {
        title: "No se encontró una cámara trasera",
        message: "Conecta un dispositivo con cámara e inténtalo de nuevo.",
      };
    }
  }

  return {
    title: "No se pudo iniciar la cámara",
    message: "Comprueba los permisos de la cámara e inténtalo de nuevo.",
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [result, setResult] = useState("");
  const [error, setError] = useState<ScannerError | null>(null);
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<WsConnectionStatus>("connecting");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { roomId } = appRoute.useParams();

  useEffect(() => {
    const socket = new WebSocket(
      `${import.meta.env.VITE_SIGOPER_COMPANION_WS_URL}/${roomId}`,
    );
    wsRef.current = socket;

    socket.onopen = () => setConnectionStatus("connected");
    socket.onclose = () => setConnectionStatus("disconnected");
    socket.onerror = () => setConnectionStatus("disconnected");

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    if (screen !== "scanning" || !videoRef.current) {
      return;
    }

    const scanner = new QrScanner(
      videoRef.current,
      (scanResult) => {
        scanner.stop();
        setResult(scanResult.data);
        extractInformationFromEstigiaUrl(scanResult.data);
        setError(null);
        setScreen("result");
      },
      {
        preferredCamera: "environment",
        maxScansPerSecond: 5,
        highlightScanRegion: false,
        highlightCodeOutline: false,
      },
    );

    scanner.start().catch((cameraError: unknown) => {
      setError(getCameraError(cameraError));
    });

    return () => scanner.destroy();
  }, [screen]);

  function extractInformationFromEstigiaUrl(estigiaUrl: string) {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        action: "extract_information_from_estigia_orden_despacho",
        data: { estigiaOrdenDespachoUrl: estigiaUrl },
      }),
    );
  }

  function startScanning() {
    setError(null);
    setScreen("scanning");
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError(null);
    setIsReadingImage(true);

    QrScanner.scanImage(file, { returnDetailedScanResult: true })
      .then((scanResult) => {
        setResult(scanResult.data);
        extractInformationFromEstigiaUrl(scanResult.data);
        setScreen("result");
      })
      .catch((scanError: unknown) => {
        setError(
          scanError === QrScanner.NO_QR_CODE_FOUND
            ? {
                title: "No se encontró un código QR",
                message:
                  "Escoge una imagen más clara que contenga un solo código QR.",
              }
            : {
                title: "No se pudo leer la imagen",
                message: "Escoge otra imagen o vuelve al escáner de cámara.",
              },
        );
      })
      .finally(() => setIsReadingImage(false));
  }

  function resetToHome() {
    setError(null);
    setScreen("home");
  }

  return (
    <main className="app-shell">
      <div className="app-card">
        <header className="panel-header">
          <div className="brand-lockup">
            <img src={logoUrl} alt="" className="panel-logo" />
            <div>
              <p className="eyebrow">SIGOPER</p>
              <h1>Companion</h1>
            </div>
          </div>
          {screen !== "home" && (
            <button className="icon-button" type="button" onClick={resetToHome}>
              ×
            </button>
          )}
        </header>

        <div className={`connection-status ${connectionStatus}`}>
          <span className="status-dot" />
          <span>{connectionLabels[connectionStatus]}</span>
          <span className="status-context">Sala de despacho</span>
        </div>

        {screen === "home" && (
          <section className="intro-panel" aria-labelledby="page-title">
            <div className="brand-mark" aria-hidden="true">
              ⌁
            </div>
            <p className="eyebrow accent-eyebrow">Lector QR</p>
            <h2 id="page-title">Escanea una orden de despacho</h2>
            <p className="intro-copy">
              Lee el código QR de una orden para compartir su información con
              SIGOPER.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={startScanning}
            >
              Comenzar a escanear <span>→</span>
            </button>
          </section>
        )}

        {screen === "scanning" && (
          <section className="scanner-panel" aria-labelledby="scanner-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow accent-eyebrow">Escáner de cámara</p>
                <h2 id="scanner-title">Apunta al código QR</h2>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={resetToHome}
              >
                Cancelar
              </button>
            </div>

            <div className="camera-frame">
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="Vista de cámara"
              />
              <div className="scan-guide" aria-hidden="true" />
              <p className="camera-hint">Mantén el código dentro del marco</p>
            </div>

            {error && (
              <div className="status-message error-message" role="alert">
                <strong>{error.title}</strong>
                <span>{error.message}</span>
                <button
                  className="inline-button"
                  type="button"
                  onClick={startScanning}
                >
                  Intentar cámara de nuevo
                </button>
              </div>
            )}

            <div className="scanner-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadingImage}
              >
                {isReadingImage
                  ? "Escaneando la imagen…"
                  : "Escoger una imagen"}
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
              />
            </div>
          </section>
        )}

        {screen === "result" && (
          <section className="result-panel" aria-labelledby="result-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow accent-eyebrow">Última recepción</p>
                <h2 id="result-title">Código QR encontrado</h2>
              </div>
              <span className="received-badge">Recibida</span>
            </div>
            <div className="result-card">
              <span className="detail-label">Contenido de la orden</span>
              <pre className="result-text">{result}</pre>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={startScanning}
            >
              Escanear otra orden <span>→</span>
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
