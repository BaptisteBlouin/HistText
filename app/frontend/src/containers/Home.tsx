// Home.tsx - Updated with config.json for configuration
import React from 'react';
import reactLogo from '../images/logo.svg';
import rustLogo from '../images/logo2.svg';
import plus from '../images/plus.svg';
import enp from '../images/logo.png';
import config from '../../config.json';

export const Home = () => {
  // Access configuration from config.json
  const homeMessage = config.HOME_MESSAGE ||
    "The application is currently in beta version. Feel free to try it out with the free / free account.";
  
  const iframeUrl = config.HOME_URL ||
    "https://www.enpchina.eu/2024/09/03/poc/";
  
  const displayLogo = config.USE_HOME_LOGO !== false; 

  return (
    <div>
      {displayLogo && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={enp} className="App-logo" alt="react-logo" />
        </div>
      )}
      <p dangerouslySetInnerHTML={{ __html: homeMessage.replace(/\n/g, '<br>') }} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <iframe
          src={iframeUrl}
          width="100%"
          height="800px"
          title="ENP China Website"
        ></iframe>
      </div>
    </div>
  );
};