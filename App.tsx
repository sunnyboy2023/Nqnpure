import React, { useState, useRef } from 'react';
import { 
  Camera, 
  RotateCcw, 
  Pencil, 
  Eraser, 
  AlertCircle,
  Loader2,
  X,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { cn } from './lib/utils';
import { parseSudokuImage } from './services/gemini';

// --- Types ---

type CellValue = number | null;
type Notes = Set<number>;

interface Cell {
  value: CellValue;
  isInitial: boolean;
  notes: Notes;
}

type Board = Cell[][];

// --- Constants ---

const createEmptyBoard = (): Board => Array(9).fill(null).map(() => 
  Array(9).fill(null).map(() => ({
    value: null,
    isInitial: false,
    notes: new Set(),
  }))
);

// --- Components ---

export default function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]); // Store as JSON strings for deep copy
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // --- Logic ---

  const saveToHistory = (currentBoard: Board) => {
    const serialized = JSON.stringify(currentBoard, (key, value) => {
      if (value instanceof Set) return { _type: 'Set', data: Array.from(value) };
      return value;
    });
    setHistory(prev => [...prev.slice(-19), serialized]);
  };

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell([row, col]);
  };

  const updateCellValue = (num: number | null) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;

    saveToHistory(board);
    
    const newBoard = board.map((row, rIdx) => {
      if (rIdx !== r) return row;
      return row.map((cell, cIdx) => {
        if (cIdx !== c) return cell;
        
        if (num === null) {
          return { ...cell, value: null, notes: new Set<number>(), isInitial: false };
        }
        
        if (isNoteMode) {
          const newNotes = new Set(cell.notes);
          if (newNotes.has(num)) {
            newNotes.delete(num);
          } else {
            newNotes.add(num);
          }
          return { ...cell, value: null, notes: newNotes, isInitial: false };
        } else {
          return { ...cell, value: num, notes: new Set<number>(), isInitial: false };
        }
      });
    });
    
    setBoard(newBoard);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const grid = await parseSudokuImage(base64);
          const newBoard: Board = grid.map(row => 
            row.map(val => ({
              value: val === 0 ? null : val,
              isInitial: val !== 0,
              notes: new Set(),
            }))
          );
          setBoard(newBoard);
          setHistory([]);
          setSelectedCell(null);
        } catch (err) {
          setError("画像の解析に失敗しました。もう一度試してください。");
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("ファイルの読み込みに失敗しました。");
      setIsLoading(false);
    }
  };

  const resetBoard = () => {
    if (confirm("盤面をリセットしますか？")) {
      setBoard(createEmptyBoard());
      setHistory([]);
      setSelectedCell(null);
    }
  };

  const downloadBoard = async () => {
    if (!gridRef.current) return;
    try {
      const dataUrl = await toPng(gridRef.current, { 
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          borderRadius: '0'
        }
      });
      const link = document.createElement('a');
      link.download = `sudoku-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('oops, something went wrong!', err);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const lastSerialized = history[history.length - 1];
    const restored: Board = JSON.parse(lastSerialized, (key, value) => {
      if (value && typeof value === 'object' && value._type === 'Set') {
        return new Set(value.data);
      }
      return value;
    });
    setBoard(restored);
    setHistory(prev => prev.slice(0, -1));
  };

  // --- Render Helpers ---

  const isInvalid = (r: number, c: number, val: number) => {
    if (!val) return false;
    // Check row
    for (let i = 0; i < 9; i++) {
      if (i !== c && board[r][i].value === val) return true;
    }
    // Check col
    for (let i = 0; i < 9; i++) {
      if (i !== r && board[i][c].value === val) return true;
    }
    // Check box
    const boxR = Math.floor(r / 3) * 3;
    const boxC = Math.floor(c / 3) * 3;
    for (let i = boxR; i < boxR + 3; i++) {
      for (let j = boxC; j < boxC + 3; j++) {
        if ((i !== r || j !== c) && board[i][j].value === val) return true;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="max-w-xl mx-auto px-6 py-8 flex items-center justify-between border-b border-black/5">
        <div>
          <h1 className="text-2xl font-serif italic tracking-tight">Sudoku Lens</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-semibold">Intelligent Solver & Player</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={downloadBoard}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            title="Download as Image"
          >
            <Download size={20} strokeWidth={1.5} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            title="Upload Image"
          >
            <Camera size={20} strokeWidth={1.5} />
          </button>
          <button 
            onClick={resetBoard}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
            title="Reset"
          >
            <RotateCcw size={20} strokeWidth={1.5} />
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm"
            >
              <AlertCircle size={18} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sudoku Grid */}
        <div 
          ref={gridRef}
          className="relative aspect-square w-full bg-white rounded-3xl shadow-2xl shadow-black/5 border border-black/5 overflow-hidden p-1 sm:p-2 touch-none select-none"
        >
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
              <p className="text-sm font-medium opacity-60">画像を解析中...</p>
            </div>
          )}
          
          <div className="grid grid-cols-9 h-full w-full border-[1.5px] border-black">
            {board.map((row, r) => {
              const selectedValue = selectedCell ? board[selectedCell[0]][selectedCell[1]].value : null;
              
              return row.map((cell, c) => {
                const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                const isSameValue = selectedValue !== null && cell.value === selectedValue;

                // 1. Highlight lines of the selected cell
                const isLineOfSelected = selectedCell && (selectedCell[0] === r || selectedCell[1] === c);

                // 2. Highlight lines of cells with the same value
                let isLineOfSameValue = false;
                if (selectedValue !== null) {
                  const rowHasValue = board[r].some(cell => cell.value === selectedValue);
                  const colHasValue = board.some(rowArr => rowArr[c].value === selectedValue);
                  isLineOfSameValue = rowHasValue || colHasValue;
                }

                const isSameBox = selectedCell && (Math.floor(selectedCell[0] / 3) === Math.floor(r / 3) && Math.floor(selectedCell[1] / 3) === Math.floor(c / 3));
                const isHighlight = isLineOfSelected || isLineOfSameValue || isSameBox;
                const invalid = cell.value ? isInvalid(r, c, cell.value) : false;

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    className={cn(
                      "relative flex items-center justify-center cursor-pointer transition-all duration-150 border-[0.5px] border-black/10 text-lg sm:text-2xl font-medium",
                      (c + 1) % 3 === 0 && c < 8 && "border-r-[1.5px] border-r-black",
                      (r + 1) % 3 === 0 && r < 8 && "border-b-[1.5px] border-b-black",
                      isSelected ? "bg-emerald-600 text-white z-10 scale-105 shadow-lg rounded-sm" : 
                      isSameValue ? "bg-emerald-200 text-emerald-900" :
                      isHighlight ? "bg-emerald-50" : "bg-white",
                      cell.isInitial ? "font-bold" : "font-normal text-emerald-700",
                      invalid && !isSelected && "bg-red-50 text-red-600"
                    )}
                  >
                    {cell.value ? (
                      <span>{cell.value}</span>
                    ) : (
                      <div className="grid grid-cols-3 w-full h-full p-0.5 pointer-events-none">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <div key={n} className="flex items-center justify-center text-[10px] sm:text-[12px] leading-none opacity-60 font-semibold">
                            {cell.notes.has(n) ? n : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 space-y-6">
          {/* Mode Toggle & Undo */}
          <div className="flex items-center justify-between px-2">
            <div className="flex bg-black/5 p-1 rounded-full">
              <button 
                onClick={() => setIsNoteMode(false)}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-bold transition-all",
                  !isNoteMode ? "bg-white shadow-sm text-black" : "text-black/40"
                )}
              >
                数字
              </button>
              <button 
                onClick={() => setIsNoteMode(true)}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                  isNoteMode ? "bg-white shadow-sm text-black" : "text-black/40"
                )}
              >
                <Pencil size={12} />
                メモ
              </button>
            </div>
            
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="flex items-center gap-2 text-xs font-bold opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
            >
              <RotateCcw size={14} />
              元に戻す
            </button>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => updateCellValue(num)}
                className="aspect-square flex items-center justify-center bg-white border border-black/5 rounded-2xl text-xl font-medium hover:bg-emerald-50 hover:border-emerald-200 active:scale-95 transition-all shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => updateCellValue(null)}
              className="aspect-square flex flex-col items-center justify-center bg-white border border-black/5 rounded-2xl hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all shadow-sm text-red-500 group"
              title="消去"
            >
              <Eraser size={24} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-bold mt-1 opacity-60">消去</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-xl mx-auto px-6 py-12 text-center opacity-30">
        <p className="text-[10px] uppercase tracking-widest">Sudoku Lens v1.0 • Built with Gemini AI</p>
      </footer>
    </div>
  );
}
