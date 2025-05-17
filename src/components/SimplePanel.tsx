import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

interface Props extends PanelProps<SimpleOptions> { }

const getStyles = () => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  options: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 10px;
    gap: 10px;
  `,
  selectInput: css`
    max-width: 200px;
    height: 34px;
  `,
  outputText: css`
    width: 100%;
    flex: 1;
    overflow-y: auto;
    white-space: pre-wrap;
  `,
  sectionTitle: css`
    font-weight: bold;
    margin-top: 12px;
  `,
});

const analysisOptions: { [key: string]: string } = {
  Summary: `Task - Give me a summary of the behavior.\n`,
  Trends: `Task - Analyze the behavior and describe the trend \n`,
  Peak: `Task - When this metric peaks? \n`,
  Custom: '', // vacío, lo escribe el usuario
};

const dataToCSV = (data: Props['data'], selectedSeriesIndex: number): string => {
  if (!data.series.length || !data.series[selectedSeriesIndex]) return 'No data available.';

  const series = data.series[selectedSeriesIndex];
  const fields = series.fields;
  const numRows = fields[0].values.length;

  const headers = fields.map((f) => f.name).join(',');
  const rows = [];

  for (let i = 0; i < numRows; i++) {
    const row = fields.map((f) => f.values.get(i)).join(',');
    rows.push(row);
  }

  const csv = [headers, ...rows].join('\n');
  return csv;
};

export const SimplePanel: React.FC<Props> = ({ options, width, height, data }) => {
  const styles = useStyles2(getStyles);

  const [buttonText, setButtonText] = useState('Analyze with AI');
  const [buttonEnabled, setButtonEnabled] = useState(true);
  const [analysisText, setAnalysisText] = useState('');
  const [csvMarkdown, setCsvMarkdown] = useState('');
  const [selectedOption, setSelectedOption] = useState('Resumen');
  const [prompt, setPrompt] = useState(analysisOptions['Resumen']);
  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleOptionChange = (event: any) => {
    const selected = event.target.value;
    setSelectedOption(selected);

    if (selected !== 'Custom') {
      setPrompt(analysisOptions[selected]);
    } else {
      setPrompt(customPrompt); // si hay algo ya escrito
    }
  };

  const handleCustomPromptChange = (event: any) => {
    const value = event.target.value;
    setCustomPrompt(value);
    setPrompt(value);
  };


  const handleSeriesChange = (event: any) => {
    setSelectedSeriesIndex(Number(event.target.value));
  };

  const onButtonClick = async () => {
    try {
      setButtonText('Analyzing...');
      setButtonEnabled(false);

      const csvData = dataToCSV(data, selectedSeriesIndex);
      setCsvMarkdown(`\`\`\`csv\n${csvData}\n\`\`\``);

      const context1 = `- Don't return times in timestamps, always return them in human-readable dates.\n`;
      const context2 = `Context: - The metrics correspond to ${options.panelContext}.\n`;
      const csvData1 = `Here is the raw data in CSV:\n${csvData}\n`;
      //const language = `Responde en Español\n`;
      //const fullPrompt = `${context1}${context2}${prompt}${csvData1}${language}`;
      const fullPrompt = `${csvData1}${context1}${context2}${prompt}`;
      console.log(fullPrompt);

      const response = await fetch(options.apiUrl || 'http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || 'llama3',
          prompt: fullPrompt,
          stream: false,
        }),
      });

      const json = await response.json();
      const content = json.response || 'No response from model.';
      setAnalysisText(content);
      setButtonText('Analyze with AI');
      setButtonEnabled(true);
    } catch (err) {
      console.error('❌ Error:', err);
      setAnalysisText('Error generating analysis.');
      setCsvMarkdown('');
      setButtonText('Analyze with AI');
      setButtonEnabled(true);
    }
  };

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <div className={cx(styles.options)}>
        {/* Selección del tipo de análisis */}
        <select value={selectedOption} onChange={handleOptionChange} className={cx(styles.selectInput)}>
          {Object.keys(analysisOptions).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        {/* Selección de la serie de datos */}
        {data.series.length > 1 && (
          <select
            value={selectedSeriesIndex}
            onChange={handleSeriesChange}
            className={cx(styles.selectInput)}
          >
            {data.series.map((serie, index) => (
              <option key={index} value={index}>
                {serie.name || `Serie ${index + 1}`}
              </option>
            ))}
          </select>
        )}

        {/* Botón de análisis */}
        <button onClick={onButtonClick} disabled={!buttonEnabled}>
          {buttonText}
        </button>

        {selectedOption === 'Custom' && (
          <textarea
            placeholder="Write your own prompt..."
            value={customPrompt}
            onChange={handleCustomPromptChange}
            rows={3}
            className={css`
            min-width: 300px;
            padding: 6px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 4px;
            border: 1px solid #ccc;
          `}
          />
        )}

      </div>

      {/* Muestra del CSV */}
      {csvMarkdown && options.showDataSend && (
        <>
          <div className={cx(styles.sectionTitle)}>📋 Data sent:</div>
          <ReactMarkdown className={cx(styles.outputText)}>{csvMarkdown}</ReactMarkdown>
        </>
      )}

      {/* Muestra de la respuesta IA */}
      {analysisText && (
        <>
          <div className={cx(styles.sectionTitle)}>🧠 AI:</div>
          <ReactMarkdown className={cx(styles.outputText)}>{analysisText}</ReactMarkdown>
        </>
      )}
    </div>
  );
};
