import { useState } from 'react'
import './App.css'

type Operator = '+' | '-' | '×' | '÷'

function calculate(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
  }
}

let audioContext: AudioContext | null = null

function playClickSound() {
  audioContext ??= new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 800
  gain.gain.setValueAtTime(0.1, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.08)

  oscillator.connect(gain)
  gain.connect(audioContext.destination)

  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.08)
}

function App() {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? digit : display + digit)
    }
  }

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
      return
    }
    if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  const clear = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const toggleSign = () => {
    setDisplay((Number.parseFloat(display) * -1).toString())
  }

  const inputPercent = () => {
    setDisplay((Number.parseFloat(display) / 100).toString())
  }

  const performOperator = (nextOperator: Operator) => {
    const inputValue = Number.parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator)
      setDisplay(String(result))
      setPreviousValue(result)
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const performEquals = () => {
    const inputValue = Number.parseFloat(display)

    if (previousValue !== null && operator) {
      const result = calculate(previousValue, inputValue, operator)
      setDisplay(String(result))
      setPreviousValue(null)
      setOperator(null)
      setWaitingForOperand(true)
    }
  }

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div
        className="keypad"
        onClickCapture={(e) => {
          if (e.target instanceof HTMLButtonElement) {
            playClickSound()
          }
        }}
      >
        <button className="key function" onClick={clear}>
          {display !== '0' || previousValue !== null ? 'C' : 'AC'}
        </button>
        <button className="key function" onClick={toggleSign}>
          +/-
        </button>
        <button className="key function" onClick={inputPercent}>
          %
        </button>
        <button
          className={`key operator ${operator === '÷' ? 'active' : ''}`}
          onClick={() => performOperator('÷')}
        >
          ÷
        </button>

        <button className="key" onClick={() => inputDigit('7')}>
          7
        </button>
        <button className="key" onClick={() => inputDigit('8')}>
          8
        </button>
        <button className="key" onClick={() => inputDigit('9')}>
          9
        </button>
        <button
          className={`key operator ${operator === '×' ? 'active' : ''}`}
          onClick={() => performOperator('×')}
        >
          ×
        </button>

        <button className="key" onClick={() => inputDigit('4')}>
          4
        </button>
        <button className="key" onClick={() => inputDigit('5')}>
          5
        </button>
        <button className="key" onClick={() => inputDigit('6')}>
          6
        </button>
        <button
          className={`key operator ${operator === '-' ? 'active' : ''}`}
          onClick={() => performOperator('-')}
        >
          -
        </button>

        <button className="key" onClick={() => inputDigit('1')}>
          1
        </button>
        <button className="key" onClick={() => inputDigit('2')}>
          2
        </button>
        <button className="key" onClick={() => inputDigit('3')}>
          3
        </button>
        <button
          className={`key operator ${operator === '+' ? 'active' : ''}`}
          onClick={() => performOperator('+')}
        >
          +
        </button>

        <button className="key zero" onClick={() => inputDigit('0')}>
          0
        </button>
        <button className="key" onClick={inputDecimal}>
          .
        </button>
        <button className="key operator equals" onClick={performEquals}>
          =
        </button>
      </div>
    </div>
  )
}

export default App
