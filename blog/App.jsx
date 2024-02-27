import './App.css'
import React from 'react';

// Function fro displaying the name and profile pic
const ProfileImage = ({ src, size }) => {
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
  };
  
  const imageStyleDefault = {
    width: size,
    height: size,
    border: '0.5px solid #7393B3',
    borderRadius: '40%', /* Adjust for desired curve */
    objectFit: 'cover', /* Ensure image fills container */
  };

  const imageStyleOne = {
    width: size,
    height: size,
    borderRadius: '40%', /* Adjust for desired curve */
    objectFit: 'cover', /* Ensure image fills container */
  };

  const textStyle = {
    whiteSpace: 'nowrap', // Prevent text wrapping
    overflow: 'hidden', // Hide overflow content
    textOverflow: 'ellipsis', // Show ellipsis for overflow
    marginRight: '10px',
    // maxWidth: '200px', // Set maximum width for text (adjust as needed)
  };

  

  return (
    <div style={rowStyle}>
      <h2 style={textStyle}>Albert Hajek</h2>
      <img src={src} alt="Profile Image" style={imageStyleDefault} />
    </div>
  );
};

const OtherImage = ({ src, size, text }) => {
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
  };

  const imageStyleDefault = {
    width: size,
    height: size,
    borderRadius: '40%', /* Adjust for desired curve */
    objectFit: 'cover', /* Ensure image fills container */
  };

  const textStyle = {
    whiteSpace: 'nowrap', // Prevent text wrapping
    overflow: 'hidden', // Hide overflow content
    textOverflow: 'ellipsis', // Show ellipsis for overflow
    marginLeft: '10px',
    // maxWidth: '200px', // Set maximum width for text (adjust as needed)
  };

  return (
    <div style={rowStyle}>
      <img src={src} alt="Profile Image" style={imageStyleDefault} />
      <p style={textStyle}>{text}</p>
    </div>
  );
};

const RowBehavior = ( { objectOne, objectTwo } ) => {
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={rowStyle}>
      {objectOne}
      {objectTwo}
    </div>
  );
}

/*
{RowBehavior({ 
  objectOne: <span class="material-symbols-outlined">
                location_on
              </span>,
  objectTwo: <p>42</p>,
})}
*/

export default function App() {
  return (
    <main>
      <div class="container">
        <div class="centered-div">
          <p><a href="/">&lt; Go back</a></p>
        </div>
        <div class="centered-div-center">
          <p>No blog entries yet</p>
        </div>
      </div>
    </main>
  )
}


/*
{ProfileImage({ src: "assets/profile.jpg", size: 36 })}
{OtherImage({ src: "assets/pin.svg", size: 15, text: "42" })}
{OtherImage({ src: "assets/work.svg", size: 15, text: "HS @ GVID" })}
<div class="finding"><p>You can find me on:</p></div>
<p>X / Twitter: <a href="https://twitter.com/albert_hajek">@albert_hajek</a></p>
<p>Threads: <a href="https://www.threads.net/@albert_hajek">@albert_hajek</a></p>
<p>Linkedin: <a href="https://www.linkedin.com/in/albert-hajek-85a873188/">@albert_hajek</a></p>
<p>Github: <a href="https://github.com/KDAB1175">@albert_hajek</a></p>
<p>Or check out my blog:</p>
*/