import './LoadingSpinner.css'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div className="spinner" />
    </div>
  )
}

export default LoadingSpinner
