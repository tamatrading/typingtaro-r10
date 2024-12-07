import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, Dog, Volume2, VolumeX, Settings } from 'lucide-react';
import KeyboardHands from './KeyboardHands';
import { GameSettings, ScorePopup, CurrentWord, Particle } from '../types/game';
import {
  stageBackgrounds,
  stageSets,
  romajiMap,
} from '../constants/gameConstants';

interface Props {
  settings: GameSettings;
  onAdminRequest: () => void;
}

const TypingGame: React.FC<Props> = ({ settings, onAdminRequest }) => {
  const [stage, setStage] = useState(settings.selectedStages[0]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState('start');
  const [speedMultiplier, setSpeedMultiplier] = useState(settings.speed);
  const [currentWord, setCurrentWord] = useState<CurrentWord | null>(null);
  const [input, setInput] = useState('');
  const [life, setLife] = useState(10);
  const [questionCount, setQuestionCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [totalStagesCompleted, setTotalStagesCompleted] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [scoreAnimation, setScoreAnimation] = useState(false);
  const [shakeAnimation, setShakeAnimation] = useState(false);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<string[]>([]);
  const [lastCharacter, setLastCharacter] = useState<string>('');
  const [showSuccessEffect, setShowSuccessEffect] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentBackground, setCurrentBackground] = useState<string>('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const finalScoreRef = useRef<number>(0);
  const previousHighScoreRef = useRef<number>(0);
  const currentStageIndexRef = useRef(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);

  // Keep gameStateRef in sync with gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const chars = settings.selectedStages.flatMap(
      (stageNum) => stageSets[stageNum as keyof typeof stageSets]
    );
    setAvailableCharacters(chars);
  }, [settings.selectedStages]);

  useEffect(() => {
    setSpeedMultiplier(settings.speed);
    setStage(settings.selectedStages[0]);
    currentStageIndexRef.current = 0;
    if (settings.isRandomMode) {
      const backgrounds = Object.values(stageBackgrounds);
      setCurrentBackground(
        backgrounds[Math.floor(Math.random() * backgrounds.length)]
      );
    }
  }, [settings]);

  const getRandomBackground = useCallback(() => {
    const backgrounds = Object.values(stageBackgrounds);
    return backgrounds[Math.floor(Math.random() * backgrounds.length)];
  }, []);

  const playSound = useCallback(
    (freq: number, type: OscillatorType, dur: number, vol = 0.3) => {
      if (isMuted || !audioContextRef.current) return;
      try {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, audioContextRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          audioContextRef.current.currentTime + dur
        );
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        osc.stop(audioContextRef.current.currentTime + dur);
      } catch (e) {
        console.error(e);
      }
    },
    [isMuted]
  );

  const playTypeSound = useCallback(
    () => playSound(800, 'square', 0.05, 0.1),
    [playSound]
  );
  const playCorrectSound = useCallback(() => {
    playSound(880, 'sine', 0.1, 0.2);
    playSound(1760, 'sine', 0.15, 0.1);
  }, [playSound]);
  const playMissSound = useCallback(
    () => playSound(220, 'square', 0.15, 0.2),
    [playSound]
  );
  const playStageClearSound = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((note, i) => {
      setTimeout(() => playSound(note, 'sine', 0.5, 0.2), i * 200);
    });
  }, [playSound]);
  const playGameClearSound = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((note, i) => {
      setTimeout(() => {
        playSound(note, 'sine', 0.8, 0.15);
        if (i % 2 === 0) playSound(note / 2, 'triangle', 0.8, 0.1);
      }, i * 300);
    });
  }, [playSound]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'start') {
        if (e.key === 'v') {
          onAdminRequest();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onAdminRequest]);

  useEffect(() => {
    const savedHighScore = localStorage.getItem('typingGameHighScore');
    if (savedHighScore) {
      const parsedHighScore = parseInt(savedHighScore, 10);
      setHighScore(parsedHighScore);
      previousHighScoreRef.current = parsedHighScore;
    }
  }, []);

  const updateHighScore = useCallback((finalScore: number) => {
    finalScoreRef.current = finalScore;
    if (finalScore > previousHighScoreRef.current) {
      return true;
    }
    return false;
  }, []);

  const saveNewHighScore = useCallback(() => {
    if (finalScoreRef.current > previousHighScoreRef.current) {
      localStorage.setItem(
        'typingGameHighScore',
        finalScoreRef.current.toString()
      );
      previousHighScoreRef.current = finalScoreRef.current;
      setHighScore(finalScoreRef.current);
    }
  }, []);

  const initAudio = useCallback(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          setGameState('playing');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const resetGame = useCallback(() => {
    initAudio();
    saveNewHighScore();
    setScore(0);
    setStage(settings.selectedStages[0]);
    currentStageIndexRef.current = 0;
    setLife(10);
    setQuestionCount(0);
    setInput('');
    setGameState('countdown');
    setTotalStagesCompleted(0);
    setCurrentWord(null);
    setScorePopups([]);
    finalScoreRef.current = 0;
    setLastCharacter('');
    startCountdown();
  }, [initAudio, saveNewHighScore, settings.selectedStages, startCountdown]);

  const convertToRomaji = useCallback((word: string) => {
    if (!word) return [];
    return romajiMap[word as keyof typeof romajiMap] || [word];
  }, []);

  const calculateScore = useCallback(
    (y: number) => {
      const maxScore = 8;
      const minScore = 1;
      const maxHeight = 100;

      return Math.max(
        minScore,
        Math.ceil(maxScore * (1 - y / maxHeight) * (1 + speedMultiplier * 0.2))
      );
    },
    [speedMultiplier]
  );

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      x,
      y,
      color: ['#60A5FA', '#34D399', '#FBBF24'][Math.floor(Math.random() * 3)],
    }));
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.find((np) => np.id === p.id))
      );
    }, 1000);
  }, []);

  const createScorePopup = useCallback(
    (score: number, x: number, y: number) => {
      const newPopup = {
        id: Date.now(),
        score,
        x,
        y,
      };
      setScorePopups((prev) => [...prev, newPopup]);
      setTimeout(() => {
        setScorePopups((prev) =>
          prev.filter((popup) => popup.id !== newPopup.id)
        );
      }, 1000);
    },
    []
  );

  const saveHighScoreToStorage = useCallback((score: number) => {
    if (score >= previousHighScoreRef.current) {
      localStorage.setItem('typingGameHighScore', score.toString());
    }
  }, []);

  const gameOver = useCallback(() => {
    setGameState('gameover');
    setCurrentWord(null);
    updateHighScore(score);
    saveHighScoreToStorage(score);
    playGameClearSound();
  }, [playGameClearSound, score, updateHighScore, saveHighScoreToStorage]);

  const checkStageClear = useCallback(() => {
    if (questionCount >= 19) {
      currentStageIndexRef.current++;

      const shouldEndGame = settings.isRandomMode
        ? totalStagesCompleted + 1 >= settings.numStages
        : currentStageIndexRef.current >= settings.selectedStages.length;

      if (shouldEndGame) {
        setGameState('clear');
        updateHighScore(score);
        saveHighScoreToStorage(score);
        playGameClearSound();
      } else {
        setGameState('stageClear');
        playStageClearSound();
      }
      return true;
    }
    return false;
  }, [
    questionCount,
    totalStagesCompleted,
    settings.isRandomMode,
    settings.numStages,
    settings.selectedStages.length,
    playGameClearSound,
    playStageClearSound,
    score,
    updateHighScore,
    saveHighScoreToStorage,
  ]);

  const nextStage = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (settings.isRandomMode) {
        setCurrentBackground(getRandomBackground());
        setStage(
          settings.selectedStages[
            Math.floor(Math.random() * settings.selectedStages.length)
          ]
        );
      } else {
        setStage(settings.selectedStages[currentStageIndexRef.current]);
      }
      setQuestionCount(0);
      setInput('');
      setGameState('countdown');
      setCurrentWord(null);
      setIsTransitioning(false);
      setTotalStagesCompleted((prev) => prev + 1);
      setLastCharacter('');
      startCountdown();
    }, 500);
  }, [
    settings.selectedStages,
    settings.isRandomMode,
    getRandomBackground,
    startCountdown,
  ]);

  const createNewWord = useCallback(() => {
    let text;
    const currentSet = stageSets[stage as keyof typeof stageSets];

    if (stage === 1) {
      text = Math.random() < 0.5 ? 'F' : 'J';
    } else {
      if (questionCount > 0 && questionCount % 4 === 3) {
        text = Math.random() < 0.5 ? 'F' : 'J';
      } else {
        if (settings.isRandomMode) {
          let availableChars = availableCharacters.filter(
            (char) => char !== 'F' && char !== 'J' && char !== lastCharacter
          );
          if (availableChars.length === 0) {
            availableChars = availableCharacters.filter(
              (char) => char !== 'F' && char !== 'J'
            );
          }
          text =
            availableChars[Math.floor(Math.random() * availableChars.length)];
        } else {
          let availableChars = currentSet.filter(
            (char) => char !== 'F' && char !== 'J' && char !== lastCharacter
          );
          if (availableChars.length === 0) {
            availableChars = currentSet.filter(
              (char) => char !== 'F' && char !== 'J'
            );
          }
          text =
            availableChars[Math.floor(Math.random() * availableChars.length)];
        }
      }
    }

    setLastCharacter(text);
    return {
      id: Date.now(),
      text,
      x: Math.random() * 80 + 10,
      y: -10,
      speed: (0.6 + Math.random() * 0.09) * speedMultiplier,
      startTime: Date.now(),
    };
  }, [
    stage,
    questionCount,
    speedMultiplier,
    settings.isRandomMode,
    availableCharacters,
    lastCharacter,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing' || !currentWord) return;

      // IME入力をブロック
      if (e.isComposing) return;

      const key = e.key.toUpperCase();
      // 英数字と記号以外はスキップ
      if (!/^[A-Z0-9\-.,]$/.test(key)) return;

      const correctRomaji = convertToRomaji(currentWord.text);
      const newInput = (input + key).toUpperCase();

      const isPartiallyCorrect = correctRomaji.some((romaji) =>
        romaji.startsWith(newInput)
      );

      if (!isPartiallyCorrect) {
        setLife((prev) => {
          const newLife = prev - 1;
          if (newLife <= 0) {
            gameOver();
            return 0;
          }
          return newLife;
        });
        playMissSound();
        setInput('');
        setShakeAnimation(true);
        setTimeout(() => setShakeAnimation(false), 500);
        return;
      }

      setInput(newInput);
      playTypeSound();

      if (correctRomaji.includes(newInput)) {
        const pointsEarned = calculateScore(currentWord.y);
        setScore((prev) => prev + pointsEarned);
        setInput('');
        setQuestionCount((prev) => prev + 1);
        playCorrectSound();

        if (currentWord) {
          createParticles(currentWord.x, currentWord.y);
          createScorePopup(pointsEarned, currentWord.x, currentWord.y);
          setShowSuccessEffect(true);
          setTimeout(() => setShowSuccessEffect(false), 500);
        }

        setScoreAnimation(true);
        setTimeout(() => setScoreAnimation(false), 300);

        if (!checkStageClear()) {
          setCurrentWord(createNewWord());
        }
      }
    },
    [
      currentWord,
      input,
      convertToRomaji,
      gameOver,
      playMissSound,
      playTypeSound,
      calculateScore,
      playCorrectSound,
      createParticles,
      createScorePopup,
      checkStageClear,
      createNewWord,
    ]
  );

  useEffect(() => {
    if (gameState === 'playing') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [gameState, handleKeyDown]);

  useEffect(() => {
    if (gameState === 'playing' && !currentWord && !isTransitioning) {
      setCurrentWord(createNewWord());
    }
  }, [gameState, currentWord, createNewWord, isTransitioning]);

  useEffect(() => {
    if (gameState !== 'playing' || !currentWord) return;

    const intervalId = setInterval(() => {
      setCurrentWord((prevWord) => {
        if (!prevWord) return null;
        const updatedWord = { ...prevWord, y: prevWord.y + prevWord.speed };
        if (updatedWord.y > 100) {
          gameOver();
          return null;
        }
        return updatedWord;
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, [gameState, currentWord, gameOver]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (gameState === 'start') {
          resetGame();
        } else if (gameState === 'stageClear') {
          nextStage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, resetGame, nextStage]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 p-4">
      <div
        className="w-full max-w-2xl p-8 bg-gradient-to-b from-blue-100 to-blue-200 shadow-xl rounded-lg"
        style={{
          transform: `scale(${settings.windowSize})`,
          transformOrigin: 'center center',
        }}
      >
        <div className="text-center mb-4">
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={onAdminRequest}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              管理
            </button>
            <h1 className="text-2xl font-bold">typingTaro r10</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-full hover:bg-gray-200 transition-transform hover:scale-110"
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center px-4">
            <div>
              <p className="text-lg">ステージ {totalStagesCompleted + 1}</p>
              {gameState === 'playing' && (
                <p className="text-sm">のこり {20 - questionCount}問</p>
              )}
            </div>
            <div className="flex gap-1 flex-wrap max-w-[200px]">
              {[...Array(life)].map((_, i) => (
                <Heart
                  key={i}
                  className="text-red-500 transition-transform hover:scale-125"
                  size={16}
                  fill="red"
                />
              ))}
            </div>
            <div>
              <p
                className={`text-lg transform transition-all duration-300 ${
                  scoreAnimation ? 'scale-125 text-green-600' : ''
                }`}
              >
                スコア: {score}
              </p>
              <p className="text-sm text-gray-600">ハイスコア: {highScore}</p>
            </div>
          </div>
        </div>

        <div
          className={`relative h-96 bg-gradient-to-b ${
            settings.isRandomMode
              ? currentBackground
              : stageBackgrounds[stage as keyof typeof stageBackgrounds]
          } rounded-lg mb-8 overflow-hidden ${
            shakeAnimation ? 'animate-[shake_0.5s_ease-in-out]' : ''
          }`}
        >
          {gameState === 'start' && (
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500 to-blue-700 flex flex-col items-center justify-center text-white">
              <h2 className="text-4xl font-bold mb-6 animate-pulse">
                タイピングTARO
              </h2>
              <Dog className="text-yellow-300 mb-6 animate-bounce" size={64} />
              <p className="text-xl mb-4">現在のハイスコア: {highScore}</p>
              <p className="text-lg mb-6">スピード: {speedMultiplier}</p>
              <button
                onClick={resetGame}
                className="bg-green-500 hover:bg-green-600 text-white text-xl py-6 px-8 rounded-lg transform transition-all duration-300 hover:scale-110 hover:rotate-1 mb-4"
              >
                スタート！
              </button>
              <p className="text-gray-200 animate-pulse mb-2">
                スペースキーでもスタートできます
              </p>
              <p className="text-gray-200 animate-pulse">
                Vキーで管理画面を開きます
              </p>
            </div>
          )}

          {gameState === 'countdown' && countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl font-bold text-white animate-pulse">
                {countdown}
              </div>
            </div>
          )}

          {gameState === 'stageClear' && (
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-300 via-green-400 to-emerald-500 flex flex-col items-center justify-center text-white">
              <h2 className="text-4xl mb-4 font-bold animate-bounce">
                ステージクリア！
              </h2>
              <Dog className="mb-4 text-yellow-300 animate-pulse" size={64} />
              <p className="text-xl mb-2">スコア: {score}</p>
              <button
                onClick={nextStage}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xl py-6 px-8 rounded-lg transform transition-all duration-300 hover:scale-110 hover:rotate-1"
              >
                次のステージへ
              </button>
              <p className="text-white mt-4 animate-pulse">
                スペースキーでも進めます
              </p>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 flex flex-col items-center justify-center text-white">
              <h2 className="text-4xl mb-4 font-bold animate-bounce">
                ゲームオーバー
              </h2>
              <Dog className="mb-4 text-slate-400" size={64} />
              <p className="text-xl mb-2">最終スコア: {score}</p>
              {finalScoreRef.current > previousHighScoreRef.current && (
                <p className="text-lg text-yellow-300 mb-2">
                  🎉 ハイスコア達成！ 🎉
                </p>
              )}
              <p className="text-lg text-slate-300 mb-4">
                ステージ {totalStagesCompleted + 1} - {questionCount}/20問クリア
              </p>
              <button
                onClick={resetGame}
                className="bg-slate-500 hover:bg-slate-600 text-white text-xl py-6 px-8 rounded-lg transform transition-all duration-300 hover:scale-110"
              >
                もう一度チャレンジ！
              </button>
            </div>
          )}

          {gameState === 'clear' && (
            <div className="absolute inset-0 bg-gradient-radial from-yellow-300 via-amber -400 to-amber-500 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-300/30 via-amber-400/20 to-amber-500/10 animate-spin-slow"></div>

              <div className="relative z-10 flex flex-col items-center justify-center max-w-lg mx-auto px-3 text-center">
                <h2 className="text-3xl sm:text-4xl md:text-4xl mb-4 text-white font-bold animate-bounce">
                  🎉 全ステージクリア！ 🎉
                </h2>

                <p className="text-xl sm:text-2xl md:text-3xl text-white mb-3 animate-pulse">
                  おめでとうございます！
                </p>

                <p className="text-lg sm:text-xl md:text-2xl text-white mb-3">
                  最終スコア: {score}
                </p>

                {finalScoreRef.current > previousHighScoreRef.current && (
                  <div className="relative mb-3">
                    {(() => {
                      saveHighScoreToStorage(score);
                      return null;
                    })()}
                    <p className="text-base sm:text-lg md:text-xl text-red animate-pulse">
                      🏆 ハイスコア達成！ 🏆
                    </p>
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 rounded-lg blur opacity-75 animate-pulse"></div>
                  </div>
                )}

                <button
                  onClick={resetGame}
                  className="relative group bg-gradient-to-br from-amber-400 to-amber-600 text-white text-lg sm:text-xl md:text-2xl py-4 sm:py-6 px-6 sm:px-8 rounded-xl transform transition-all duration-300 hover:scale-110 hover:rotate-1 overflow-hidden mt-2"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-amber-300 to-amber-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  <span className="relative">最初から挑戦！</span>
                </button>
              </div>

              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-float-random text-xl sm:text-2xl"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                    }}
                  >
                    {['🌟', '✨', '💫', '⭐'][Math.floor(Math.random() * 4)]}
                  </div>
                ))}
              </div>
            </div>
          )}

          {gameState === 'playing' && currentWord && (
            <div className="relative h-full">
              <div
                className="absolute transition-all duration-50 bg-white/20 backdrop-blur-sm rounded px-4 py-2 animate-[float_2s_ease-in-out_infinite]"
                style={{
                  left: `${currentWord.x}%`,
                  top: `${currentWord.y}%`,
                  transform: `translateX(-50%) rotate(${
                    Math.sin(currentWord.y / 10) * 5
                  }deg)`,
                }}
              >
                <div className="text-white font-bold text-2xl">
                  {currentWord.text}
                </div>
                {stage > 1 && (
                  <div className="text-gray-200 text-sm mt-1">
                    {convertToRomaji(currentWord.text)[0]}
                  </div>
                )}
              </div>

              {showSuccessEffect && (
                <div
                  className="absolute w-32 h-32 pointer-events-none"
                  style={{
                    left: `${currentWord.x}%`,
                    top: `${currentWord.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-[success-flash_0.5s_ease-out_forwards]"></div>
                  <div className="absolute inset-0 border-4 border-white/40 rounded-full animate-[success-ring_0.5s_ease-out_forwards]"></div>
                </div>
              )}
              <KeyboardHands
                highlightedKey={currentWord?.text || ''}
                currentInput={input}
                show={settings.showHands}
              />
            </div>
          )}

          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full animate-[particle_1s_ease-out_forwards]"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
              }}
            />
          ))}

          {scorePopups.map((popup) => (
            <div
              key={popup.id}
              className="absolute text-2xl font-bold text-yellow-300 animate-[scorePopup_1s_ease-out_forwards]"
              style={{
                left: `${popup.x}%`,
                top: `${popup.y}%`,
                transform: 'translateX(-50%)',
                textShadow: '0 0 10px rgba(0,0,0,0.5)',
              }}
            >
              +{popup.score}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypingGame;
