export const NezhaLogo = ({ 
  className,
  textFill = "#3A3F46",
  subTextFill = "#8B8B8B"
}: { 
  className?: string;
  textFill?: string;
  subTextFill?: string;
}) => (
  <svg viewBox="0 0 420 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="icon-clip">
        <rect x="0" y="0" width="100" height="100" rx="28" />
      </clipPath>
    </defs>
    <g clipPath="url(#icon-clip)">
      {/* Orange background */}
      <rect x="0" y="0" width="100" height="100" fill="#ED8136" />
      
      {/* Pink bun */}
      <circle cx="38" cy="32" r="18" fill="#E8526F" stroke="#FFFFFF" strokeWidth="6" />
      {/* Pink ribbon */}
      <path d="M 35 48 C 20 48 8 55 8 62 C 15 62 25 58 35 52 Z" fill="#E8526F" />
      
      {/* Face circle */}
      <circle cx="75" cy="75" r="50" fill="#ED8136" stroke="#FFFFFF" strokeWidth="6" />
      
      {/* Eyes */}
      <rect x="58" y="58" width="10" height="26" rx="5" fill="#FFFFFF" />
      <rect x="82" y="58" width="10" height="26" rx="5" fill="#FFFFFF" />
    </g>
    
    <g transform="translate(125, 0)">
      <text x="0" y="55" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="54" fill={textFill} letterSpacing="6">哪吒科技</text>
      <text x="2" y="86" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="500" fontSize="21" fill={subTextFill} letterSpacing="15">电子商务自动化</text>
    </g>
  </svg>
);
