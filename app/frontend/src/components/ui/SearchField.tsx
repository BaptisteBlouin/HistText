import React from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  TextFieldProps
} from '@mui/material';
import { Search, Close } from '@mui/icons-material';

interface SearchFieldProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  ...props
}) => {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <TextField
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={handleClear}>
              <Close />
            </IconButton>
          </InputAdornment>
        ),
        ...props.InputProps
      }}
    />
  );
};

export default React.memo(SearchField);