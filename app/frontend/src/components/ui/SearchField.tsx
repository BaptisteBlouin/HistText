import React from "react";
import {
  TextField,
  InputAdornment,
  IconButton,
  TextFieldProps,
} from "@mui/material";
import { Search, Close } from "@mui/icons-material";

/**
 * Props for SearchField component.
 * - `value`: Current search text.
 * - `onChange`: Handler for value change, receives new string.
 * - `onClear`: Optional handler for clear action.
 * - `placeholder`: Input placeholder text.
 * - All TextFieldProps (except 'onChange') are supported.
 */
interface SearchFieldProps extends Omit<TextFieldProps, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

/**
 * A TextField with a search icon and clear button.
 * - Shows a start adornment with a search icon.
 * - Shows a clear button when value is non-empty.
 * - Calls onChange with updated string on input or clear.
 */
const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  ...props
}) => {
  const handleClear = () => {
    onChange("");
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
        ...props.InputProps,
      }}
    />
  );
};

export default React.memo(SearchField);
