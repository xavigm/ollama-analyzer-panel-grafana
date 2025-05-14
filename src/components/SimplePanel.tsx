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
  Resumen: `Hazme un resumen de lo que ves.`,
  Tendencias: `¿Qué tendencias ves?`,
  Pico: `Dime cual es el momento de pico de esta metrica.`,
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

  const [buttonText, setButtonText] = useState('Analizar con IA');
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
      setButtonText('Analizando...');
      setButtonEnabled(false);

      const csvData = dataToCSV(data, selectedSeriesIndex);
      setCsvMarkdown(`\`\`\`csv\n${csvData}\n\`\`\``);

      const context1 = `Eres un analista de metricas de Grafana. No devuelvas tiempos en timestamp, siempre en fecha legible. Revisa la tendencia, lo que ves, y responde con un analisis y lo que puede estar ocurriendo\n`;
      const context2 = `Las metricas son de ${options.panelContext}. Por tanto los valores son timestamp y % de CPU. \n`;
      const csvData1 = `Aquí tienes los datos brutos en CSV:\n${csvData}\n`;
      const language = `Responde en Español\n`;
      const fullPrompt = `${context1}${context2}${prompt}${csvData1}${language}`;
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
      setButtonText('Analizar con IA');
      setButtonEnabled(true);
    } catch (err) {
      console.error('❌ Error:', err);
      setAnalysisText('Error al generar el análisis.');
      setCsvMarkdown('');
      setButtonText('Analizar con IA');
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
            placeholder="Escribe tu propio prompt..."
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
      {csvMarkdown && (
        <>
          <div className={cx(styles.sectionTitle)}>📋 Datos:</div>
          <ReactMarkdown className={cx(styles.outputText)}>{csvMarkdown}</ReactMarkdown>
        </>
      )}

      {/* Muestra de la respuesta IA */}
      {analysisText && (
        <>
          <div className={cx(styles.sectionTitle)}>🧠 IA:</div>
          <ReactMarkdown className={cx(styles.outputText)}>{analysisText}</ReactMarkdown>
        </>
      )}
    </div>
  );
};
