import { Search, X } from 'lucide-react'
import { useState } from 'react'

interface SearchBarProps {
  onSearch: (term: string) => void
  placeholder?: string
}

export const SearchBar = ({ onSearch, placeholder = "Search articles..." }: SearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    onSearch(value)
  }

  const handleClear = () => {
    setSearchTerm('')
    onSearch('')
  }

  return (
    <div className="bf-search-bar">
      <Search className="bf-search-bar__icon" size={20} />
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder={placeholder}
        className="bf-search-bar__input"
      />
      {searchTerm && (
        <button 
          onClick={handleClear} 
          className="bf-search-bar__clear"
          aria-label="Clear search"
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}

